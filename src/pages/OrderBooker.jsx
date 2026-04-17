import React, { useState, useEffect, useMemo } from 'react';
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
  const [activeTab, setActiveTab] = useState('shop'); // shop (selection), invoice, history
  const [showSuccess, setShowSuccess] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [startY, setStartY] = useState(0);
  const [pulling, setPulling] = useState(false);
  const [topProducts, setTopProducts] = useState([]);
  const user = getActiveUser();

  const loadData = async () => {
    const invData = await getInventory();
    setLocalInventory(invData);
    
    const custData = await getCustomers();
    setLocalCustomers(custData);
    
    const ordData = await getOrders();
    // Show only my orders
    const myOrders = ordData.filter(o => o.bookerId === user?.id && o.status !== 'cancelled');
    setPastOrders(myOrders);

    // Calculate Top Products (Most frequent in last 50 orders)
    const counts = {};
    myOrders.slice(-50).forEach(o => {
      o.items.forEach(item => { counts[item.id] = (counts[item.id] || 0) + 1; });
    });
    const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 8);
    setTopProducts(sorted.map(s => invData.find(i => String(i.id) === String(s[0]))).filter(Boolean));
  };

  const filteredCustomers = useMemo(() => {
    return (customers || []).filter(c => 
      c.name?.toLowerCase().includes(search.toLowerCase()) || 
      c.id?.toLowerCase().includes(search.toLowerCase())
    );
  }, [customers, search]);

  // AUTO-SELECT SHOP if only one match remains (Smart Workflow)
  useEffect(() => {
     if (search.length >= 3 && filteredCustomers.length === 1 && !selectedCustomerId) {
        handleCustomerSelect(filteredCustomers[0].id);
     }
  }, [search, filteredCustomers, selectedCustomerId]);

  useEffect(() => {
    const init = async () => {
      const s = await getTaxSettings();
      setSettingsObj(s);
      await loadData();
    };
    init();
    
    const handleScroll = () => {
      if (window.scrollY > 300) setShowScrollTop(true);
      else setShowScrollTop(false);
    };
    window.addEventListener('scroll', handleScroll);
    
    const intv = setInterval(loadData, 10000); 
    return () => {
      clearInterval(intv);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const selectedCustomer = customers.find(c => String(c.id) === String(selectedCustomerId));

  const handleCompleteOrder = async (method, formattedText, totalValue, format, subtotalAfterDiscount) => {
    await saveOrder({
      bookerId: user?.id,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      items: cart.map(c => ({ id: c.id, qty: c.qty, discount: c.discount })),
      totalValue,
      subtotalAfterDiscount,
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
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setActiveTab('history');
    }, 1500);
  };

  const handleCustomerSelect = (customerId) => {
    setSelectedCustomerId(customerId);
    setActiveTab('invoice');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelPlacedOrder = async (orderId) => {
    if (!window.confirm("Are you sure you want to cancel this order?")) return;
    const reason = prompt("Enter Cancellation Reason:");
    if (!reason?.trim()) return;

    const orderToCancel = pastOrders.find(o => String(o.id) === String(orderId));
    await cancelOrder(orderId, reason.trim());
    await loadData();

    if (orderToCancel && window.confirm("Cancelled. Restore items to cart?")) {
       const invData = await getInventory();
       const mappedCart = orderToCancel.items.map(item => ({
           id: item.id, qty: item.qty, discount: item.discount || 0, product: invData.find(i => String(i.id) === String(item.id))
       }));
       setCart(mappedCart);
       setSelectedCustomerId(orderToCancel.customerId);
       setActiveTab('invoice');
    }
  };

  const todaysSales = pastOrders
    .filter(o => new Date(o.date).toLocaleDateString() === new Date().toLocaleDateString() && o.status === 'confirmed')
    .reduce((sum, o) => sum + (o.totalValue || 0), 0);

  const todaysTargetSales = pastOrders
    .filter(o => new Date(o.date).toLocaleDateString() === new Date().toLocaleDateString() && o.status === 'confirmed')
    .reduce((sum, o) => sum + (o.subtotalAfterDiscount || 0), 0);

  const DAILY_TARGET = 20000;
  const targetProgress = Math.min((todaysTargetSales / DAILY_TARGET) * 100, 100);

  return (
    <div className="container" 
       onTouchStart={e => setStartY(e.touches[0].clientY)}
       onTouchMove={e => {
          if (window.scrollY === 0 && e.touches[0].clientY - startY > 100) setPulling(true);
       }}
       onTouchEnd={() => {
          if (pulling) { loadData(); setPulling(false); }
       }}
    >
      {showScrollTop && (
         <button 
           className="btn btn-primary fixed bottom-20 right-4 z-[100] shadow-xl w-10 h-10 rounded-full flex items-center justify-center border-2 border-white"
           onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
         >
           ↑
         </button>
      )}
      {pulling && (
        <div className="fixed top-0 left-0 w-full z-[1000] bg-primary text-white text-[10px] py-1 flex justify-center items-center gap-2 shadow-lg animate-in-top">
           <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
           <span className="font-bold tracking-tight">Refreshing Data...</span>
        </div>
      )}
      {showSuccess && (
        <div className="success-overlay">
           <div className="checkmark-container">
             <span>✓</span>
           </div>
        </div>
      )}
      {/* Header Sticky Dashboard */}
      <div className="dashboard-header-premium animate-in">
        <div className="flex justify-between items-center w-full">
           <div className="flex gap-4 items-center">
             <button 
               onClick={() => { window.location.reload(); }} 
               className="btn btn-outline p-0 border-none text-slate-300 hover:text-white"
               title="Reload Data"
               style={{ minWidth: '32px', height: '32px', background: 'transparent' }}
             >
               🔄
             </button>
             <div>
               <h2 className="portal-title">{user?.name} Portal</h2>
               <p className="portal-subtitle">Jazaa Field Operations</p>
             </div>
           </div>
           <div className="flex gap-3">
             <div className="text-right sales-pill" style={{ background: 'rgba(255,255,255,0.05)' }}>
               <p className="sales-label">Orders</p>
               <p className="sales-amount" style={{ fontSize: '1.2rem' }}>{pastOrders.filter(o => new Date(o.date).toLocaleDateString() === new Date().toLocaleDateString() && o.status === 'confirmed').length}</p>
             </div>
             <div className="text-right sales-pill">
               <p className="sales-label">Today's Sales</p>
               <p className="sales-amount">Rs. {todaysSales.toLocaleString()}</p>
             </div>
           </div>
        </div>
        {/* TARGET PROGRESS BAR */}
         <div className="mt-4 bg-black/20 rounded-full h-4 overflow-hidden border border-white/10 relative">
            <div 
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-1000 ease-out"
              style={{ width: `${targetProgress}%` }}
            ></div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
               <span className="text-[9px] font-bold text-white uppercase tracking-tighter">
                 Daily Target: Rs. {todaysTargetSales.toLocaleString()} / {DAILY_TARGET.toLocaleString()} ({Math.round(targetProgress)}%)
               </span>
            </div>
         </div>
      </div>

      {/* SHOP TAB: Customer Selection */}
      {activeTab === 'shop' && (
        <div className="animate-in">
          <div className="mb-4">
             <h3 className="text-lg">Step 1: Select Shop / Customer</h3>
             <p className="text-sm text-muted">Identify who you are booking this order for.</p>
          </div>

          {topProducts.length > 0 && (
            <div className="mb-6">
              <p className="text-[10px] uppercase font-bold text-muted mb-2 tracking-widest">Your Top Selling Items</p>
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {topProducts.map(p => (
                  <div key={p.id} className="bg-white border border-slate-100 rounded-xl px-3 py-2 text-[11px] shadow-sm whitespace-nowrap flex flex-col gap-0 border-l-4 border-l-primary cursor-default shrink-0 min-w-[120px]">
                    <span className="font-bold text-slate-700 truncate">{p.name}</span>
                    <span className={`text-[9px] font-bold ${p.stock <= 5 ? 'text-red-500' : (p.stock <= 15 ? 'text-orange-500' : 'text-slate-400')}`}>Stock: {p.stock}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={`relative ${pastOrders.length === 0 ? 'onboarding-pulse' : ''}`}>
            <CustomerManager onSelect={handleCustomerSelect} />
          </div>
        </div>
      )}

      {/* INVOICE ENTRY TAB: High Speed Entry */}
      {activeTab === 'invoice' && (
        <div className="animate-in">
           {selectedCustomer && settingsObj ? (
             <InvoiceGenerator 
               customer={selectedCustomer}
               inventory={inventory}
               settingsObj={settingsObj}
               onSend={handleCompleteOrder}
               onCancel={() => {setCart([]); setSelectedCustomerId(''); setActiveTab('shop');}}
               initialCart={cart}
             />
           ) : (
             <div className="card text-center py-12">
               <p className="text-muted text-sm">No shop selected. Please go back.</p>
               <button className="btn btn-primary mt-4" onClick={() => setActiveTab('shop')}>Select Shop</button>
             </div>
           )}
        </div>
      )}

       {/* HISTORY TAB: Past Orders */}
       {activeTab === 'history' && (
         <div className="animate-in">
            <h3 className="mb-4 text-slate-800">Field Performance</h3>
            
            {/* NEW: Personal EOD Flash Card */}
            <div className="card !bg-emerald-600 !border-emerald-500 mb-6 shadow-xl shadow-emerald-900/10">
               <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-[10px] uppercase font-bold text-emerald-100 tracking-[0.2em] mb-1">Your EOD Recap (Today)</h4>
                    <p className="text-[10px] text-emerald-200">Personal performance snapshot</p>
                  </div>
                  <span className="bg-emerald-400/30 text-white text-[9px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md">LIVE</span>
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                     <p className="text-[9px] text-emerald-100 uppercase font-black mb-1">Total Booked</p>
                     <p className="text-xl font-black text-white">Rs. {todaysSales.toLocaleString()}</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                     <p className="text-[9px] text-emerald-100 uppercase font-black mb-1">Confirmed</p>
                     <p className="text-xl font-black text-white">{pastOrders.filter(o => new Date(o.date).toLocaleDateString() === new Date().toLocaleDateString() && o.status === 'confirmed').length} <span className="text-[11px] font-normal opacity-70">orders</span></p>
                  </div>
               </div>

               {(() => {
                  const todayItems = {};
                  pastOrders
                    .filter(o => new Date(o.date).toLocaleDateString() === new Date().toLocaleDateString() && o.status === 'confirmed')
                    .forEach(o => {
                      o.items.forEach(i => {
                        todayItems[i.id] = (todayItems[i.id] || 0) + i.qty;
                      });
                    });
                  const topItemId = Object.entries(todayItems).sort((a,b) => b[1] - a[1])[0]?.[0];
                  const topItem = inventory.find(i => String(i.id) === String(topItemId));
                  
                  if (!topItem) return null;
                  return (
                    <div className="mt-4 pt-3 border-t border-white/10 flex justify-between items-center text-white">
                       <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-100">Your Top Item Today</p>
                       <p className="text-[10px] font-black truncate max-w-[150px]">{topItem.name} 🛒 {todayItems[topItemId]}</p>
                    </div>
                  );
               })()}
            </div>

            <div className="card-list">
               {pastOrders.length === 0 ? (
                 <div className="card text-center py-8 text-muted text-sm">No orders found.</div>
               ) : (
                 (() => {
                    let lastDate = '';
                    return pastOrders.slice().reverse().map(o => {
                      const orderDate = new Date(o.date).toLocaleDateString();
                      const showHeader = orderDate !== lastDate;
                      lastDate = orderDate;
                      return (
                        <div key={o.id}>
                          {showHeader && (
                            <div className="sticky top-[100px] z-[5] bg-slate-50/80 backdrop-blur-sm py-2 px-1 text-[10px] uppercase font-bold text-slate-400 tracking-widest border-b border-slate-100 mb-2">
                              📅 {orderDate === new Date().toLocaleDateString() ? "Today" : orderDate}
                            </div>
                          )}
                          <div className="card-item hover:scale-[1.01] transition-transform">
                             <div className="card-item-header">
                                <div>
                                   <p className="font-bold text-sm text-slate-700">{o.customerName}</p>
                                   <p className="text-xs text-muted">{new Date(o.date).toLocaleTimeString()}</p>
                                </div>
                                <p className="font-black text-primary">Rs. {o.totalValue?.toLocaleString()}</p>
                             </div>
                             <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-50">
                                <span className="text-[10px] font-bold uppercase bg-slate-100 px-2 py-0.5 rounded text-slate-500 tracking-tighter">{o.invoiceFormat} FORMAT</span>
                                {o.status === 'confirmed' ? (
                                  <div className="flex gap-2 items-center">
                                    <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">CONFIRMED</span>
                                    {user?.can_cancel_orders !== false && (
                                      <button className="btn !bg-red-50 !text-red-600 hover:!bg-red-600 hover:!text-white border border-red-100" style={{ minHeight: '28px', height: '28px', fontSize: '0.65rem', padding: '0 0.6rem', borderRadius: '8px' }} onClick={() => handleCancelPlacedOrder(o.id)}>
                                        CANCEL
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[9px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full border border-red-200">CANCELLED</span>
                                )}
                             </div>
                          </div>
                        </div>
                      );
                    });
                 })()
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
        <div className={`nav-item ${activeTab === 'invoice' ? 'active' : ''}`} onClick={() => setActiveTab('invoice')}>
           <span className="nav-icon">📄</span>
           <span>Invoice</span>
        </div>
        <div className={`nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
           <span className="nav-icon">📋</span>
           <span>Orders</span>
        </div>
      </nav>
    </div>
  );
}
