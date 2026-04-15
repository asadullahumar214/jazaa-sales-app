import React, { useState, useEffect } from 'react';
import { getInventory, getCustomers, saveOrder, getActiveUser, getOrders, cancelOrder, getTaxSettings } from '../store';
import CustomerManager from '../components/CustomerManager';
import InvoiceGenerator from '../components/InvoiceGenerator';

export default function OrderBooker() {
  const [inventory, setLocalInventory] = useState([]);
  const [customers, setLocalCustomers] = useState([]);
  const [pastOrders, setPastOrders] = useState([]);
  const [settingsObj, setSettingsObj] = useState(null);
  
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('shop'); // shop (selection), inventory, cart, history
  const user = getActiveUser();

  const loadData = async () => {
    const invData = await getInventory();
    setLocalInventory(invData);
    
    const custData = await getCustomers();
    setLocalCustomers(custData);
    
    const ordData = await getOrders();
    // Show only my orders, or all if needed, but here we filter by booker per legacy requirements
    const myOrders = ordData.filter(o => o.bookerId === user?.id && o.status !== 'cancelled');
    setPastOrders(myOrders);
  };

  useEffect(() => {
    const init = async () => {
      const s = await getTaxSettings();
      setSettingsObj(s);
      await loadData();
    };
    init();
    
    const intv = setInterval(loadData, 10000); 
    return () => clearInterval(intv);
  }, []);

  const selectedCustomer = customers.find(c => String(c.id) === String(selectedCustomerId));

  const addToCart = (product) => {
    if (!selectedCustomer) {
      alert("Please select a customer first.");
      setActiveTab('shop');
      return;
    }
    
    setCart(prev => {
      const existing = prev.find(item => String(item.id) === String(product.id));
      const currentQty = existing ? existing.qty : 0;
      
      if (currentQty + 1 > product.stock) {
        alert("Cannot exceed available inventory stock!");
        return prev;
      }

      if (existing) {
        return prev.map(item => String(item.id) === String(product.id) ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { id: product.id, product, qty: 1 }];
    });
  };

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (String(item.id) === String(id)) {
        const newQty = item.qty + delta;
        if (newQty > item.product.stock) {
           alert("Cannot exceed available stock!");
           return item;
        }
        return newQty > 0 ? { ...item, qty: newQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const handleCompleteOrder = async (method, formattedText, totalValue, format) => {
    await saveOrder({
      bookerId: user?.id,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      items: cart.map(c => ({ id: c.id, qty: c.qty })),
      totalValue,
      invoiceFormat: format
    });

    if (method === 'whatsapp') {
      let phone = selectedCustomer.phone || '';
      let formattedPhone = phone.replace(/[^0-9]/g, '');
      if (formattedPhone.startsWith('0')) formattedPhone = '92' + formattedPhone.substring(1);
      else if (formattedPhone.length === 10) formattedPhone = '92' + formattedPhone;
      window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(formattedText)}`, '_blank');
    } else {
      const subject = encodeURIComponent(`Invoice: ${selectedCustomer.name}`);
      window.open(`mailto:?subject=${subject}&body=${encodeURIComponent(formattedText)}`);
    }

    setCart([]);
    setSelectedCustomerId('');
    await loadData();
    setActiveTab('history');
    alert("Order successfully processed!");
  };

  const handleCustomerSelect = (customerId) => {
    if (cart.length > 0 && String(customerId) !== String(selectedCustomerId)) {
      if (!window.confirm("Changing customers will clear your current cart. Continue?")) return;
      setCart([]);
    }
    setSelectedCustomerId(customerId);
    setActiveTab('inventory');
    // Scroll to top to see search bar
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelPlacedOrder = async (orderId) => {
    const reason = prompt("Cancellation reason:");
    if (!reason?.trim()) return;

    const orderToCancel = pastOrders.find(o => String(o.id) === String(orderId));
    await cancelOrder(orderId, reason.trim());
    await loadData();

    if (orderToCancel && window.confirm("Cancelled. Restore items to cart?")) {
       const invData = await getInventory();
       const mappedCart = orderToCancel.items.map(item => ({
           id: item.id, qty: item.qty, product: invData.find(i => String(i.id) === String(item.id))
       }));
       setCart(mappedCart);
       setSelectedCustomerId(orderToCancel.customerId);
       setActiveTab('cart');
    }
  };

  const filteredInventory = inventory.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.brand && p.brand.toLowerCase().includes(search.toLowerCase())) ||
    (p.category && p.category.toLowerCase().includes(search.toLowerCase()))
  );
  const todaysSales = pastOrders
    .filter(o => new Date(o.date).toLocaleDateString() === new Date().toLocaleDateString() && o.status === 'confirmed')
    .reduce((sum, o) => sum + (o.totalValue || 0), 0);

  return (
    <div className="container">
      {/* Header Sticky Dashboard */}
      <div className="flex justify-between items-center mb-6 bg-white p-3 rounded-lg border border-slate-200 sticky top-0 z-50">
        <div>
          <h2 style={{ fontSize: '1.1rem', margin: 0 }}>{user?.name} Portal</h2>
          <p className="text-xs text-muted">Jazaa Sales Booking</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted uppercase font-bold" style={{ fontSize: '0.6rem' }}>Today's Sales</p>
          <p style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Rs. {todaysSales.toLocaleString()}</p>
        </div>
      </div>

      {/* SHOP TAB: Customer Selection */}
      {activeTab === 'shop' && (
        <div className="animate-in">
          <div className="mb-4">
             <h3 className="text-lg">Step 1: Select Shop / Customer</h3>
             <p className="text-sm text-muted">Identify who you are booking this order for.</p>
          </div>
          
          <div className="card-list">
             <CustomerManager onSelect={handleCustomerSelect} />
          </div>
        </div>
      )}

      {/* INVENTORY TAB: Add Products */}
      {activeTab === 'inventory' && (
        <div className="animate-in">
           <div className="flex justify-between items-end mb-4 gap-4 sticky top-[72px] bg-slate-50 py-2 z-40">
              <input 
                type="text" 
                placeholder="Search name, brand, or category..." 
                className="form-input" 
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
           </div>

           {selectedCustomerId && (
              <div className="card bg-blue-50 border-blue-200 p-3 mb-4 flex justify-between items-center" onClick={() => setActiveTab('shop')}>
                 <div>
                    <p className="text-xs text-blue-700 uppercase font-bold">Booking For:</p>
                    <p className="text-sm font-bold text-blue-900">{selectedCustomer?.name}</p>
                 </div>
                 <button className="btn btn-outline" style={{ minHeight: '32px', height: '32px', fontSize: '0.7rem', padding: '0 0.5rem' }}>Change</button>
              </div>
           )}

           {!selectedCustomerId && (
              <div className="card bg-amber-50 border-amber-200 p-4 mb-4" onClick={() => setActiveTab('shop')}>
                 <p className="text-sm text-amber-800">⚠️ <strong>No shop selected!</strong> Tap to choose a customer first.</p>
              </div>
           )}

           <div className="grid grid-cols-1 gap-3">
             {filteredInventory.map(item => {
                const inCart = cart.find(c => c.id === item.id);
                const isOutOfStock = item.stock <= 0;
                return (
                  <div key={item.id} className="card flex justify-between items-center" style={{ padding: '0.75rem', opacity: isOutOfStock ? 0.6 : 1 }}>
                     <div style={{ flex: 1 }}>
                        <h4 className="text-sm">{item.name}</h4>
                        <p className="text-xs text-muted">{item.brand} • {item.category}</p>
                        <p className="text-xs font-bold mt-1" style={{ color: isOutOfStock ? '#ef4444' : item.stock < 10 ? '#f59e0b' : '#22c55e' }}>
                          {isOutOfStock ? 'OUT OF STOCK' : item.stock < 10 ? `LOW STOCK: ${item.stock}` : `Stock: ${item.stock}`}
                        </p>
                     </div>
                     
                     <div style={{ width: '100px' }}>
                        {inCart ? (
                          <div className="flex justify-between items-center bg-slate-100 rounded-lg p-1">
                            <button className="btn btn-outline" style={{minWidth:'32px', height:'32px', minHeight:'32px', padding:0}} onClick={() => updateQty(item.id, -1)}>-</button>
                            <span className="font-bold text-sm">{inCart.qty}</span>
                            <button className="btn btn-outline" style={{minWidth:'32px', height:'32px', minHeight:'32px', padding:0}} onClick={() => updateQty(item.id, 1)}>+</button>
                          </div>
                        ) : (
                          <button 
                            className="btn btn-primary" 
                            style={{ 
                              width: '100%', 
                              padding: '0.4rem', 
                              fontSize: '0.8rem', 
                              minHeight: '38px', 
                              opacity: isOutOfStock || !selectedCustomerId ? 0.5 : 1,
                              transform: inCart ? 'scale(0.95)' : 'scale(1)',
                              transition: 'all 0.1s ease'
                            }} 
                            disabled={isOutOfStock || !selectedCustomerId}
                            onClick={(e) => {
                              addToCart(item);
                              e.currentTarget.style.transform = 'scale(0.9)';
                              setTimeout(() => e.currentTarget.style.transform = 'scale(1)', 100);
                            }}
                          >
                            {inCart ? 'Added ✓' : 'Add'}
                          </button>
                        )}
                     </div>
                  </div>
                )
             })}
           </div>
        </div>
      )}

      {/* CART TAB: Review & Invoice */}
      {activeTab === 'cart' && (
        <div className="animate-in">
           {cart.length > 0 && selectedCustomer && settingsObj ? (
             <InvoiceGenerator 
               cart={cart}
               customer={selectedCustomer}
               settingsObj={settingsObj}
               onSend={handleCompleteOrder}
               onCancel={() => {setCart([]); setActiveTab('inventory');}}
             />
           ) : (
             <div className="card text-center py-12">
               <p className="text-muted text-sm">Cart is empty. Go back to Inventory.</p>
               <button className="btn btn-primary mt-4" onClick={() => setActiveTab('inventory')}>Browse Inventory</button>
             </div>
           )}
        </div>
      )}

      {/* HISTORY TAB: Past Orders */}
      {activeTab === 'history' && (
        <div className="animate-in">
           <h3 className="mb-4">My Placed Orders</h3>
           <div className="card-list">
              {pastOrders.length === 0 ? (
                <div className="card text-center py-8 text-muted text-sm">No orders found.</div>
              ) : (
                pastOrders.slice().reverse().map(o => o && (
                  <div key={o.id} className="card-item">
                     <div className="card-item-header">
                        <div>
                           <p className="font-bold text-sm">{o.customerName}</p>
                           <p className="text-xs text-muted">{new Date(o.date).toLocaleString()}</p>
                        </div>
                        <p className="font-bold text-primary">Rs. {o.totalValue?.toLocaleString()}</p>
                     </div>
                     <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-50">
                        <span className="text-xs uppercase bg-slate-100 px-2 py-0.5 rounded">{o.invoiceFormat}</span>
                        <button className="btn btn-danger" style={{ minHeight: '32px', height: '32px', fontSize: '0.75rem', padding: '0 0.5rem' }} onClick={() => handleCancelPlacedOrder(o.id)}>
                          Cancel
                        </button>
                     </div>
                  </div>
                ))
              )}
           </div>
        </div>
      )}

      {/* BOTTOM NAVIGATION BAR */}
      <nav className="bottom-nav">
        <div className={`nav-item ${activeTab === 'shop' ? 'active' : ''}`} onClick={() => setActiveTab('shop')}>
           <span className="nav-icon">🏪</span>
           <span>Shop</span>
        </div>
        <div className={`nav-item ${activeTab === 'inventory' ? 'active' : ''}`} onClick={() => setActiveTab('inventory')}>
           <span className="nav-icon">📊</span>
           <span>Stock</span>
        </div>
        <div className={`nav-item ${activeTab === 'cart' ? 'active' : ''}`} onClick={() => setActiveTab('cart')}>
           <span className="nav-icon">🛒</span>
           <span>Cart {cart.length > 0 && <span style={{fontSize:'0.6rem', background:'var(--danger)', color:'white', padding:'2px 5px', borderRadius:'10px', marginLeft:'2px'}}>{cart.length}</span>}</span>
        </div>
        <div className={`nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
           <span className="nav-icon">📋</span>
           <span>Orders</span>
        </div>
      </nav>
    </div>
  );
}
