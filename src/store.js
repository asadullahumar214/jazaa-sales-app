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
  const { data, error } = await supabase.from('users').select('*');
  if (error) console.error(error);
  return data || [];
};

export const setUsers = async (usersArray) => {
  // Supabase upsert
  const { error } = await supabase.from('users').upsert(usersArray);
  if (error) console.error(error);
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
  // 1. Execute stock deduction first
  const { data: invData } = await supabase.from('inventory').select('*');
  if (invData) {
    const updates = [];
    order.items.forEach(item => {
      const invItem = invData.find(i => String(i.id) === String(item.id));
      if (invItem) updates.push({ ...invItem, stock: invItem.stock - item.qty });
    });
    if (updates.length > 0) {
      await supabase.from('inventory').upsert(updates);
    }
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

  // 2. Add stock back
  const { data: invData } = await supabase.from('inventory').select('*');
  if (invData) {
    const updates = [];
    JSON.parse(JSON.stringify(orderData.items)).forEach(item => {
      const invItem = invData.find(i => String(i.id) === String(item.id));
      if (invItem) updates.push({ ...invItem, stock: invItem.stock + item.qty });
    });
    if (updates.length > 0) {
      await supabase.from('inventory').upsert(updates);
    }
  }

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
