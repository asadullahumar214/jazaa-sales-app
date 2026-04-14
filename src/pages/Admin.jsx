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

  useEffect(() => {
    const fetchData = async () => {
      const invData = await getInventory();
      setLocalInventory(invData);
      
      const ordData = await getOrders();
      setLocalOrders(ordData);

      const logs = await getAuditLogs() || [];
      const todayStr = new Date().toLocaleDateString();
      const newCusts = logs.filter(l => 
        l.action === 'CUSTOMER_CREATED' && 
        new Date(l.timestamp).toLocaleDateString() === todayStr
      );
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

    const reason = prompt(`Overwriting stock for "${item.name}" from ${oldStock} → ${qty}.\nReason:`);
    if (reason && reason.trim()) {
      await addAuditLog({
        action: 'STOCK_OVERWRITE',
        userId: 'admin',
        details: `${item.name}: ${oldStock} → ${qty}`,
        reason: reason.trim()
      });
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
    await addAuditLog({
      action: 'FRESH_PURCHASE',
      userId: 'admin',
      details: `${item.name}: +${qty} units (${oldStock} → ${oldStock + qty})`,
      reason: 'Fresh Stock'
    });
    alert(`Successfully added ${qty} to ${item.name}!`);
  };

  const handleDownloadSample = () => {
    const sampleData = [{ id: '1', name: 'Product Name', brand: 'Jazaa', stock: 100, main_qty: 12, foc: 1 }];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, "Inventory_Template.xlsx");
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        let updated = [...inventory];
        data.forEach(row => {
          const idx = updated.findIndex(i => String(i.id) === String(row.id));
          if (idx !== -1) updated[idx] = { ...updated[idx], ...row };
        });
        setLocalInventory(updated);
        await setInventory(updated);
        alert('Bulk update complete!');
      } catch (err) { alert('Error processing file'); }
    };
    reader.readAsBinaryString(file);
  };

  const tabStyle = (tab) => ({
    padding: '0.5rem 1.25rem',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.9rem',
    background: activeTab === tab ? 'var(--primary)' : '#f1f5f9',
    color: activeTab === tab ? 'white' : 'var(--text-muted)',
    transition: 'all 0.2s ease',
    minHeight: '40px'
  });

  return (
    <div className="container">
      <h2>Sales Booking app Jazaa - Admin Dashboard</h2>
      <p className="mb-4 text-muted">Manage users, inventory, orders, and audit trails.</p>

      {/* Notifications */}
      {recentCustomers.length > 0 && (
         <div className="card" style={{ background: '#EFF6FF', borderColor: '#BFDBFE', padding: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🔔</span>
            <div>
              <p className="font-bold" style={{ margin: 0, color: '#1E3A8A' }}>Notification: New Customers Added</p>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#1E3A8A', opacity: 0.8 }}>
                 {recentCustomers.length} new customer(s) registered today. Review their pricing/tax types.
              </p>
            </div>
            <button className="btn btn-secondary" style={{ marginLeft: 'auto', background: 'white' }} onClick={() => setRecentCustomers([])}>
               Dismiss
            </button>
         </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-4 mb-4" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
        <button style={tabStyle('orders')} onClick={() => setActiveTab('orders')}>📦 Orders</button>
        <button style={tabStyle('inventory')} onClick={() => setActiveTab('inventory')}>📊 Inventory</button>
        <button style={tabStyle('customers')} onClick={() => setActiveTab('customers')}>🏪 Customers</button>
        <button style={tabStyle('users')} onClick={() => setActiveTab('users')}>👥 Users</button>
        <button style={tabStyle('audit')} onClick={() => setActiveTab('audit')}>📋 Audit</button>
        <button style={tabStyle('reports')} onClick={() => setActiveTab('reports')}>📈 Reports</button>
        <button style={tabStyle('settings')} onClick={() => setActiveTab('settings')}>⚙️ Settings</button>
      </div>

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <>
          <div className="card mt-4 mb-4">
            <h3>Confirmed Orders ({confirmedOrders.length})</h3>
            <div className="table-responsive" style={{ maxHeight: '350px', overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>OrderBooker</th>
                    <th>Customer</th>
                    <th>Format</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {confirmedOrders.length === 0 ? (
                    <tr><td colSpan="6" className="text-muted" style={{ textAlign: 'center' }}>No confirmed orders yet.</td></tr>
                  ) : (
                    confirmedOrders.slice().reverse().map(o => o && (
                      <tr key={o.id}>
                        <td>{new Date(o.date).toLocaleDateString()}</td>
                        <td>{o.bookerId || 'Unknown'}</td>
                        <td>{o.customerName}</td>
                        <td>{o.invoiceFormat || 'TP'}</td>
                        <td className="font-bold">Rs. {o.totalValue?.toFixed(2)}</td>
                        <td>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '99px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#059669'
                          }}>
                            Confirmed
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {cancelledOrders.length > 0 && (
            <div className="card mt-4 mb-4">
              <h3 style={{ color: 'var(--danger)' }}>Cancelled Orders ({cancelledOrders.length})</h3>
              <div className="table-responsive" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>OrderBooker</th>
                      <th>Customer</th>
                      <th>Total</th>
                      <th>Cancel Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cancelledOrders.slice().reverse().map(o => o && (
                      <tr key={o.id} style={{ opacity: 0.7 }}>
                        <td>{new Date(o.date).toLocaleDateString()}</td>
                        <td>{o.bookerId || 'Unknown'}</td>
                        <td>{o.customerName}</td>
                        <td>Rs. {o.totalValue?.toFixed(2)}</td>
                        <td style={{ fontStyle: 'italic', maxWidth: '200px', whiteSpace: 'normal' }}>
                          {o.cancel_reason || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Inventory Tab */}
      {activeTab === 'inventory' && (
        <>
          <div className="flex gap-4 mb-6 items-end" style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Bulk Brand Discount (FOC)</label>
              <select className="form-select" value={discountUpdate.brand} onChange={e => setDiscountUpdate({...discountUpdate, brand: e.target.value})}>
                <option value="">-- Select Brand --</option>
                {brands.filter(b => b !== 'All').map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Main Qty</label>
              <input type="number" className="form-input" style={{ width: '80px' }} value={discountUpdate.main_qty} onChange={e => setDiscountUpdate({...discountUpdate, main_qty: parseInt(e.target.value) || 0})} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>FOC</label>
              <input type="number" className="form-input" style={{ width: '80px' }} value={discountUpdate.foc} onChange={e => setDiscountUpdate({...discountUpdate, foc: parseInt(e.target.value) || 0})} />
            </div>
            <button className="btn btn-secondary" onClick={async () => {
               if (!discountUpdate.brand) return alert("Select a brand first");
               const update = inventory.map(i => (i.brand || 'Unbranded') === discountUpdate.brand ? { ...i, main_qty: discountUpdate.main_qty, foc: discountUpdate.foc } : i);
               setLocalInventory(update);
               await setInventory(update);
               alert(`Updated ${discountUpdate.brand} discounts!`);
            }}>Apply to Brand</button>
          </div>

          <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: '1rem' }}>
            <div className="flex gap-4">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <select className="form-select" value={brandFilter} onChange={e => setBrandFilter(e.target.value)}>
                   {brands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <input 
                type="text" 
                placeholder="Search products..." 
                className="form-input" 
                style={{ width: '300px', maxWidth: '100%' }}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
                 <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }} onClick={handleDownloadSample}>
                   📥 Template
                 </button>
                 <label className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', cursor: 'pointer', margin: 0 }}>
                   📤 Import
                   <input type="file" accept=".xlsx, .xls" style={{ display: 'none' }} onChange={handleFileUpload} />
                 </label>
            </div>
          </div>

          <div className="table-responsive" style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Product</th>
                  <th>Brand</th>
                  <th>Disc (Qty+FOC)</th>
                  <th>Stock</th>
                  <th>Fresh Purchase</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map(item => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.name}</td>
                    <td>{item.brand || 'Unbranded'}</td>
                    <td>
                      <div className="flex items-center gap-2">
                         <input type="number" className="form-input" style={{ width: '50px', padding: '0.2rem' }} value={item.main_qty} onChange={async (e) => {
                            const val = parseInt(e.target.value) || 0;
                            const update = inventory.map(i => i.id === item.id ? { ...i, main_qty: val } : i);
                            setLocalInventory(update);
                            await setInventory(update);
                         }} />
                         <span>+</span>
                         <input type="number" className="form-input" style={{ width: '50px', padding: '0.2rem' }} value={item.foc} onChange={async (e) => {
                            const val = parseInt(e.target.value) || 0;
                            const update = inventory.map(i => i.id === item.id ? { ...i, foc: val } : i);
                            setLocalInventory(update);
                            await setInventory(update);
                         }} />
                      </div>
                    </td>
                    <td style={{ color: item.stock <= 0 ? 'red' : item.stock <= 10 ? '#d97706' : 'green', fontWeight: 'bold' }}>
                      {item.stock}
                    </td>
                    <td>
                      <div className="flex gap-2 items-center">
                        <input id={`add_${item.id}`} type="number" placeholder="Qty" className="form-input" style={{ width: '70px', padding: '0.25rem' }} />
                        <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', minHeight: '36px' }} onClick={() => {
                            const val = document.getElementById(`add_${item.id}`).value;
                            handleAddPurchase(item.id, val);
                            document.getElementById(`add_${item.id}`).value = '';
                          }}>
                          +
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Customers Tab */}
      {activeTab === 'customers' && <CustomerManager />}

      {/* Users Tab */}
      {activeTab === 'users' && <UserManager />}

      {/* Audit Trail Tab */}
      {activeTab === 'audit' && <AuditLogViewer />}

      {/* Reports Tab */}
      {activeTab === 'reports' && <ReportsManager />}

      {/* Settings Tab */}
      {activeTab === 'settings' && <SystemSettings />}
    </div>
  );
}
