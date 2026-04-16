import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Auth Mock (Local Storage is fine for active session token for now to decouple auth from DB complexity)
export const getActiveUser = () => JSON.parse(localStorage.getItem('user') || 'null');
export const setActiveUser = (user) => {
  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
  } else {
    localStorage.removeItem('user');
  }
};

export const initStore = () => {
  console.log("Supabase Store Initialized");
  // Any specific initialization logic for Supabase client or local cache can go here
};

// Users
export const getUsers = async () => {
  const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
  if (error) console.error(error);
  return data || [];
};

export const setUsers = async (usersArray) => {
  const { error } = await supabase.from('users').upsert(usersArray);
  if (error) console.error(error);
};

export const updateLastActive = async (userId) => {
  if (!userId) return;
  const { error } = await supabase
    .from('users')
    .update({ last_active: new Date().toISOString() })
    .eq('id', userId);
  if (error) console.error("LastActive Error", error);
};

// Customers
export const getCustomers = async () => {
  const { data, error } = await supabase.from('customers').select('*');
  if (error) console.error(error);
  return data || [];
};

export const setCustomers = async (customersArray) => {
  const { error } = await supabase.from('customers').upsert(customersArray);
  if (error) console.error(error);
};

// Inventory
export const getInventory = async () => {
  const { data, error } = await supabase.from('inventory').select('*').order('id', { ascending: true });
  if (error) console.error(error);
  return data || [];
};

export const setInventory = async (inventoryArray) => {
  const { error } = await supabase.from('inventory').upsert(inventoryArray);
  if (error) console.error(error);
};

// Orders
export const getOrders = async () => {
  const { data, error } = await supabase.from('orders').select('*').order('date', { ascending: false });
  if (error) console.error(error);
  return data || [];
};

export const saveOrder = async (order) => {
  // 0. Duplicate Prevention (Same customer + same total within 5 mins)
  const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: duplicates } = await supabase.from('orders')
    .select('id')
    .eq('customerId', order.customerId)
    .eq('totalValue', order.totalValue)
    .gte('date', fiveMinsAgo);
    
  if (duplicates && duplicates.length > 0) {
    if (!window.confirm("A similar order was already placed for this shop in the last 5 minutes. Do you want to save this as a separate new order?")) {
      return { cancelled: true };
    }
  }

  // 1. Execute atomic stock deduction for each item
  const validItems = (order.items || []).filter(item => item && item.id && (item.qty || 0) > 0);
  
  const deductionPromises = validItems.map(item => 
    supabase.rpc('deduct_stock', { p_item_id: String(item.id), p_qty: parseInt(item.qty) })
  );
  
  const results = await Promise.all(deductionPromises);
  const errors = results.filter(r => r.error);
  if (errors.length > 0) {
    console.error("Some stock deductions failed:", errors);
    // Ideally rollback here, but for now we log. 
    // Atomic multi-row RPC would be better for perfect safety.
  }

  // 2. Insert order
  const orderId = Date.now().toString();
  const { error } = await supabase.from('orders').insert([{
    id: orderId,
    bookerId: order.bookerId,
    customerId: order.customerId,
    customerName: order.customerName,
    status: 'confirmed',
    totalValue: order.totalValue,
    subtotalAfterDiscount: order.subtotalAfterDiscount, // New field for targets
    invoiceFormat: order.invoiceFormat,
    items: order.items,
    date: new Date().toISOString()
  }]);
  if (error) console.error("Order Save Error", error);
};

export const cancelOrder = async (orderId, reason) => {
  // 1. Fetch the order
  const { data: orderData } = await supabase.from('orders').select('*').eq('id', orderId).single();
  if (!orderData || orderData.status === 'cancelled') return;

  // 2. Restore stock atomically
  const items = typeof orderData.items === 'string' ? JSON.parse(orderData.items) : orderData.items;
  const restorePromises = items.map(item => 
    supabase.rpc('restore_stock', { p_item_id: String(item.id), p_qty: item.qty })
  );
  await Promise.all(restorePromises);

  // 3. Mark as cancelled
  await supabase.from('orders').update({
    status: 'cancelled',
    cancel_reason: reason
  }).eq('id', orderId);

  // 4. Audit
  await addAuditLog({
    action: 'ORDER_CANCELLED',
    userId: orderData.bookerId || 'unknown',
    details: `Order #${orderId} for ${orderData.customerName} cancelled`,
    reason: reason
  });
};

// Audit Logs
export const getAuditLogs = async () => {
  const { data, error } = await supabase.from('audit_logs').select('*').order('timestamp', { ascending: false });
  if (error) console.error(error);
  // Map timestamp back to date to keep frontend compatible
  return (data || []).map(d => ({...d, date: d.timestamp}));
};

export const addAuditLog = async (logObj) => {
  const { error } = await supabase.from('audit_logs').insert([{
    action: logObj.action,
    userId: logObj.userId,
    details: logObj.details,
    reason: logObj.reason,
    timestamp: new Date().toISOString()
  }]);
  if (error) console.error(error);
};

// Settings
export const getTaxSettings = async () => {
  const { data, error } = await supabase.from('settings').select('config').eq('id', true).single();
  if (error || !data) {
     return {
      registered: { advPct: 0.005, e: 0.0, n: 0.18, r: 0.10, ts: 0.18 },
      it: { advPct: 0.005, e: 0.0, n: 0.22, r: 0.14, ts: 0.18 },
      ur: { advPct: 0.025, e: 0.0, n: 0.22, r: 0.14, ts: 0.18 }
    };
  }
  return data.config;
};

export const setTaxSettings = async (settings) => {
  const { error } = await supabase.from('settings').upsert([{ id: true, config: settings }]);
  if (error) console.error(error);
};

export const logVisit = async (visitObj) => {
  await addAuditLog({
    action: 'VISIT_NO_ORDER',
    userId: visitObj.userId,
    details: `Visited: ${visitObj.customerName} (No Order placed)`
  });
};
