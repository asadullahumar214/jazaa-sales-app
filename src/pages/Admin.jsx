import React, { useState, useEffect, useMemo } from 'react';
import { getInventory, setInventory, getOrders, addAuditLog, getAuditLogs } from '../store';
import * as XLSX from 'xlsx';
import CustomerManager from '../components/CustomerManager';
import UserManager from '../components/UserManager';
import AuditLogViewer from '../components/AuditLogViewer';
import SystemSettings from '../components/SystemSettings';
import ReportsManager from '../components/ReportsManager';

export default function Admin() {
  const [inventory, setLocalInventory] = useState([]);
  const [orders, setLocalOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('orders');
  const [recentCustomers, setRecentCustomers] = useState([]);
  const [brandFilter, setBrandFilter] = useState('All');
  const [discountUpdate, setDiscountUpdate] = useState({ brand: '', main_qty: 12, foc: 0 });

  const confirmedOrders = useMemo(() => orders.filter(o => o && o.status === 'confirmed'), [orders]);
  const cancelledOrders = useMemo(() => orders.filter(o => o && o.status === 'cancelled'), [orders]);

  useEffect(() => {
    const fetchData = async () => {
      const invData = await getInventory();
      setLocalInventory(invData);
      const ordData = await getOrders();
      setLocalOrders(ordData);
      const logs = await getAuditLogs() || [];
      const todayStr = new Date().toLocaleDateString();
      const newCusts = logs.filter(l => l.action === 'CUSTOMER_CREATED' && new Date(l.timestamp).toLocaleDateString() === todayStr);
      setRecentCustomers(newCusts);
    };
    fetchData();
    const intv = setInterval(fetchData, 10000);
    return () => clearInterval(intv);
  }, [activeTab]);

  const brands = useMemo(() => {
    const b = new Set(inventory.map(i => i.brand || 'Unbranded'));
    return ['All', ...Array.from(b)].sort();
  }, [inventory]);

  const filteredInventory = inventory.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase());
    const matchBrand = brandFilter === 'All' || (i.brand || 'Unbranded') === brandFilter;
    return matchSearch && matchBrand;
  });

  const handleStockUpdate = async (id, newStock) => {
    const qty = parseInt(newStock) || 0;
    const item = inventory.find(i => i.id === id);
    const oldStock = item ? item.stock : 0;
    const update = inventory.map(item => item.id === id ? { ...item, stock: qty } : item);
    setLocalInventory(update);
    await setInventory(update);

    const reason = prompt(`Reason for stock overwrite (${oldStock} → ${qty}):`);
    if (reason?.trim()) {
      await addAuditLog({ action: 'STOCK_OVERWRITE', userId: 'admin', details: `${item.name}: ${oldStock} → ${qty}`, reason: reason.trim() });
    }
  };

  const handleAddPurchase = async (id, amount) => {
    const qty = parseInt(amount) || 0;
    if (qty <= 0) return;
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    const oldStock = item.stock || 0;
    const update = inventory.map(i => i.id === id ? { ...i, stock: oldStock + qty } : i);
    setLocalInventory(update);
    await setInventory(update);
    await addAuditLog({ action: 'FRESH_PURCHASE', userId: 'admin', details: `${item.name}: +${qty} units`, reason: 'Stock Refill' });
    alert(`Added ${qty} units!`);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        let updated = [...inventory];
        data.forEach(row => {
          const idx = updated.findIndex(i => String(i.id) === String(row.id));
          if (idx !== -1) updated[idx] = { ...updated[idx], ...row };
        });
        setLocalInventory(updated);
        await setInventory(updated);
        alert('Bulk update complete!');
      } catch (err) { alert('File processing error'); }
    };
    reader.readAsBinaryString(file);
  };

  const tabStyle = (tab) => ({
    padding: '0.5rem 1rem',
    borderRadius: '20px',
    border: activeTab === tab ? '1px solid var(--primary)' : '1px solid #e2e8f0',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.85rem',
    background: activeTab === tab ? 'var(--primary)' : 'white',
    color: activeTab === tab ? 'white' : 'var(--text-muted)',
    whiteSpace: 'nowrap',
    minWidth: 'fit-content'
  });

  return (
    <div className="container">
      <div className="mb-6">
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Admin Dashboard</h2>
        <p className="text-sm text-muted">Core oversight and system configuration.</p>
      </div>

      {recentCustomers.length > 0 && (
         <div className="card bg-blue-50 border-blue-100 flex items-center gap-4 mb-6">
            <span className="text-xl">🔔</span>
            <div style={{ flex: 1 }}>
              <p className="font-bold text-blue-900 text-sm">{recentCustomers.length} New Shops Today</p>
              <p className="text-xs text-blue-700">Please review their tax setup in the Customers tab.</p>
            </div>
            <button className="btn btn-secondary text-xs" onClick={() => setRecentCustomers([])}>Dismiss</button>
         </div>
      )}

      {/* HORIZONTAL TAB BAR (Scrollable on Mobile) */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
        <button style={tabStyle('orders')} onClick={() => setActiveTab('orders')}>Orders</button>
        <button style={tabStyle('inventory')} onClick={() => setActiveTab('inventory')}>Inventory</button>
        <button style={tabStyle('customers')} onClick={() => setActiveTab('customers')}>Customers</button>
        <button style={tabStyle('users')} onClick={() => setActiveTab('users')}>Users</button>
        <button style={tabStyle('audit')} onClick={() => setActiveTab('audit')}>Audit</button>
        <button style={tabStyle('reports')} onClick={() => setActiveTab('reports')}>Reports</button>
        <button style={tabStyle('settings')} onClick={() => setActiveTab('settings')}>Settings</button>
      </div>

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div className="animate-in">
           <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg">Confirmed Orders</h3>
              <span className="text-xs font-bold text-muted uppercase">Recent First</span>
           </div>
           <div className="card-list">
              {confirmedOrders.length === 0 ? (
                <div className="card text-center py-8 text-muted text-sm italic">No confirmed orders.</div>
              ) : (
                confirmedOrders.slice().reverse().map(o => o && (
                  <div key={o.id} className="card-item">
                     <div className="flex justify-between items-start mb-2">
                        <div>
                           <p className="font-bold text-sm">{o.customerName}</p>
                           <p className="text-xs text-muted">Booker: {o.bookerId} • {new Date(o.date).toLocaleDateString()}</p>
                        </div>
                        <p className="font-bold text-primary">Rs. {o.totalValue?.toLocaleString()}</p>
                     </div>
                     <span className="text-[10px] font-bold uppercase bg-slate-100 px-2 py-0.5 rounded">{o.invoiceFormat}</span>
                  </div>
                ))
              )}
           </div>

           {cancelledOrders.length > 0 && (
             <div className="mt-8">
                <h3 className="text-lg mb-4" style={{ color: 'var(--danger)' }}>Cancelled Orders</h3>
                <div className="card-list">
                   {cancelledOrders.slice().reverse().map(o => o && (
                     <div key={o.id} className="card-item opacity-75">
                        <div className="flex justify-between">
                           <p className="font-bold text-sm">{o.customerName}</p>
                           <p className="text-danger font-bold">Rs. {o.totalValue?.toLocaleString()}</p>
                        </div>
                        <p className="text-xs text-muted mt-1 italic">Reason: {o.cancel_reason}</p>
                     </div>
                   ))}
                </div>
             </div>
           )}
        </div>
      )}

      {/* Inventory Tab */}
      {activeTab === 'inventory' && (
        <div className="animate-in">
           <div className="card bg-slate-50 border-slate-200 mb-6">
              <h4 className="text-sm font-bold mb-3 uppercase text-muted" style={{ fontSize: '0.7rem' }}>Bulk Management</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="form-group">
                  <label>Brand</label>
                  <select className="form-select" value={discountUpdate.brand} onChange={e => setDiscountUpdate({...discountUpdate, brand: e.target.value})}>
                    <option value="">-- Select --</option>
                    {brands.filter(b => b !== 'All').map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Qty+FOC</label>
                  <div className="flex gap-2">
                     <input type="number" className="form-input" placeholder="Min" value={discountUpdate.main_qty} onChange={e => setDiscountUpdate({...discountUpdate, main_qty: parseInt(e.target.value) || 0})} />
                     <input type="number" className="form-input" placeholder="FOC" value={discountUpdate.foc} onChange={e => setDiscountUpdate({...discountUpdate, foc: parseInt(e.target.value) || 0})} />
                  </div>
                </div>
                <button className="btn btn-secondary w-full" onClick={async () => {
                   if (!discountUpdate.brand) return alert("Select brand");
                   const update = inventory.map(i => (i.brand || 'Unbranded') === discountUpdate.brand ? { ...i, main_qty: discountUpdate.main_qty, foc: discountUpdate.foc } : i);
                   setLocalInventory(update); await setInventory(update); alert("Updated!");
                }}>Apply</button>
                <div className="flex gap-2">
                   <label className="btn btn-outline text-xs cursor-pointer flex-1 text-center">
                      📤 Import <input type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleFileUpload} />
                   </label>
                </div>
              </div>
           </div>

           <div className="flex gap-2 mb-4">
              <select className="form-select" style={{ width: '120px' }} value={brandFilter} onChange={e => setBrandFilter(e.target.value)}>
                 {brands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <input type="text" placeholder="Search SKU/Name..." className="form-input flex-1" value={search} onChange={e => setSearch(e.target.value)} />
           </div>

           <div className="card-list">
              {filteredInventory.map(item => (
                <div key={item.id} className="card-item">
                   <div className="flex justify-between items-start">
                      <div>
                         <h5 className="font-bold text-sm">{item.name}</h5>
                         <p className="text-xs text-muted">{item.brand || 'Unbranded'} • SKU: {item.id}</p>
                      </div>
                      <div className="text-right">
                         <p className={`font-bold ${item.stock <= 10 ? 'text-danger' : 'text-success'}`}>{item.stock} in stock</p>
                         <p className="text-[10px] text-muted">Promo: {item.main_qty}+{item.foc}</p>
                      </div>
                   </div>
                   <div className="mt-3 pt-3 border-t border-slate-50 flex items-center gap-2">
                      <span className="text-xs font-bold text-muted">Restock:</span>
                      <input id={`add_${item.id}`} type="number" placeholder="Qty" className="form-input" style={{ flex: 1, minHeight: '32px', fontSize: '0.8rem' }} />
                      <button className="btn btn-secondary" style={{ minHeight: '32px', padding: '0 1rem' }} onClick={() => {
                          const val = document.getElementById(`add_${item.id}`).value;
                          handleAddPurchase(item.id, val);
                          document.getElementById(`add_${item.id}`).value = '';
                      }}>+</button>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {activeTab === 'customers' && <CustomerManager />}
      {activeTab === 'users' && <UserManager />}
      {activeTab === 'audit' && <AuditLogViewer />}
      {activeTab === 'reports' && <ReportsManager />}
      {activeTab === 'settings' && <SystemSettings />}
    </div>
  );
}
