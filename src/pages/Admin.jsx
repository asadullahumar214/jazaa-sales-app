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
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('admin_active_tab') || 'orders');
  const [recentCustomers, setRecentCustomers] = useState([]);
  const [brandFilter, setBrandFilter] = useState('All');
  const [discountUpdate, setDiscountUpdate] = useState({ brand: '', main_qty: 12, foc: 0 });
  const [dateFilter, setDateFilter] = useState('Today'); // Today, Yesterday, All

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (!o) return false;
      const orderDate = new Date(o.date).toLocaleDateString();
      const today = new Date().toLocaleDateString();
      const yesterday = new Date(Date.now() - 86400000).toLocaleDateString();
      
      if (dateFilter === 'Today') return orderDate === today;
      if (dateFilter === 'Yesterday') return orderDate === yesterday;
      return true; // All
    });
  }, [orders, dateFilter]);

  const confirmedOrders = useMemo(() => filteredOrders.filter(o => o && o.status === 'confirmed'), [filteredOrders]);
  const cancelledOrders = useMemo(() => filteredOrders.filter(o => o && o.status === 'cancelled'), [filteredOrders]);

  const leaderboard = useMemo(() => {
    const stats = {};
    confirmedOrders.forEach(o => {
       if (!stats[o.bookerId]) stats[o.bookerId] = { sales: 0, count: 0 };
       stats[o.bookerId].sales += (o.totalValue || 0);
       stats[o.bookerId].count += 1;
    });
    return Object.entries(stats).sort((a,b) => b[1].sales - a[1].sales);
  }, [confirmedOrders]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    localStorage.setItem('admin_active_tab', tab);
  };

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
  
  const downloadTemplate = () => {
    const templateData = [{
      id: "SKU123",
      name: "Product Name",
      brand: "Jazaa",
      stock: 100,
      rate: 1500,
      rp: 1800,
      product_type: "N",
      main_qty: 12,
      foc: 1,
      min_price_it: 1450,
      min_price_reg: 1400,
      min_price_ur: 1500
    }];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "inventory_template.xlsx");
  };

  const exportInventoryCSV = () => {
    const ws = XLSX.utils.json_to_sheet(inventory);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory_Backup");
    XLSX.writeFile(wb, `Jazaa_Inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
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

  const generateSummaryEmail = () => {
    const today = new Date().toLocaleDateString();
    const total = confirmedOrders.reduce((sum, o) => sum + (o.totalValue || 0), 0);
    const body = `Daily Sales Summary - ${today}\n\n` +
                 `Total Orders: ${confirmedOrders.length}\n` +
                 `Total Value: Rs. ${total.toLocaleString()}\n\n` +
                 `Leaderboard:\n` +
                 leaderboard.map(([id, s]) => `- ${id}: Rs. ${s.sales.toLocaleString()} (${s.count} orders)`).join('\n');
    
    window.open(`mailto:?subject=Jazaa Sales Summary ${today}&body=${encodeURIComponent(body)}`);
  };

  const exportFilteredToCSV = () => {
    const ws = XLSX.utils.json_to_sheet(confirmedOrders.map(o => ({
      ID: o.id,
      Date: new Date(o.date).toLocaleString(),
      Shop: o.customerName,
      Booker: o.bookerId,
      Amount: o.totalValue,
      Format: o.invoiceFormat
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Daily_Report");
    XLSX.writeFile(wb, `Jazaa_Sales_Report_${new Date().toLocaleDateString()}.xlsx`);
  };

  return (
    <div className="container">
      <div className="mb-6">
        <div className="flex justify-between items-end">
          <div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Admin Dashboard</h2>
            <p className="text-sm text-muted">Core oversight and system configuration.</p>
          </div>
          <div className="text-right hidden md:block">
            <p className="text-[10px] uppercase font-bold text-muted tracking-widest">Global Sales Today</p>
            <p className="text-2xl font-bold text-primary">Rs. {confirmedOrders.reduce((s,o) => s+(o.totalValue||0),0).toLocaleString()}</p>
          </div>
        </div>
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
        <button style={tabStyle('orders')} onClick={() => handleTabChange('orders')}>Orders</button>
        <button style={tabStyle('inventory')} onClick={() => handleTabChange('inventory')}>Inventory</button>
        <button style={tabStyle('customers')} onClick={() => handleTabChange('customers')}>Customers</button>
        <button style={tabStyle('users')} onClick={() => handleTabChange('users')}>Users</button>
        <button style={tabStyle('reports')} onClick={() => handleTabChange('reports')}>Reports</button>
        <button style={tabStyle('settings')} onClick={() => handleTabChange('settings')}>Settings</button>
      </div>

           <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3">
              <h3 className="text-lg">Confirmed Orders</h3>
              <div className="flex gap-2">
                 <button className="btn btn-outline text-[10px] py-1" onClick={exportFilteredToCSV}>📥 Export XLSX</button>
                 <button className="btn btn-secondary text-[10px] py-1" onClick={generateSummaryEmail}>📧 Email Summary</button>
                 <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                  {['Today', 'Yesterday', 'All'].map(f => (
                    <button 
                      key={f} 
                      onClick={() => setDateFilter(f)}
                      className={`px-3 py-1 rounded-md text-[10px] uppercase font-bold tracking-widest transition-all ${dateFilter === f ? 'bg-white shadow-sm text-primary' : 'text-slate-500'}`}
                    >
                      {f}
                    </button>
                  ))}
                 </div>
              </div>
           </div>

           {leaderboard.length > 0 && (
             <div className="mb-6 animate-in">
               <p className="text-[10px] uppercase font-bold text-muted mb-2 tracking-widest">Performance Leaderboard</p>
               <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                  {leaderboard.map(([id, s]) => (
                    <div key={id} className="bg-white border border-slate-100 p-3 rounded-xl shadow-sm min-w-[140px] border-l-4 border-l-success">
                       <p className="text-xs font-bold text-slate-800 uppercase truncate">{id}</p>
                       <p className="text-[10px] text-muted">Rs. {s.sales.toLocaleString()}</p>
                       <div className="text-[9px] font-bold text-primary mt-1">{s.count} Orders</div>
                    </div>
                  ))}
               </div>
             </div>
           )}
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
                     <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold uppercase bg-slate-100 px-2 py-0.5 rounded text-slate-600">{o.invoiceFormat}</span>
                        <span className="text-[9px] font-bold uppercase bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">CONFIRMED</span>
                     </div>
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
                        <div className="flex justify-between items-center mt-2">
                           <p className="text-xs text-muted italic">Reason: {o.cancel_reason}</p>
                           <span className="text-[9px] font-bold uppercase bg-red-100 text-red-700 px-2 py-0.5 rounded-full border border-red-200">CANCELLED</span>
                        </div>
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
                 <div className="flex flex-wrap gap-2">
                    <button className="btn btn-outline text-[10px] flex-1 text-center py-1" onClick={downloadTemplate}>
                       📥 Template
                    </button>
                    <label className="btn btn-primary text-[10px] cursor-pointer flex-1 text-center py-1">
                       📤 Import <input type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleFileUpload} />
                    </label>
                    <button className="btn btn-secondary text-[10px] flex-1 text-center py-1 bg-green-600 hover:bg-green-700" onClick={exportInventoryCSV}>
                       📊 Export CSV
                    </button>
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
                         <p className={`font-bold ${item.stock <= 5 ? 'text-danger' : (item.stock <= 15 ? 'text-orange-500' : 'text-success')}`}>
                            {item.stock} in stock
                         </p>
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
      {activeTab === 'reports' && <ReportsManager />}
      {activeTab === 'settings' && <SystemSettings />}
    </div>
  );
}
