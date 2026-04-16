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
  const [activeTab, setActiveTab] = useState('shop'); // shop (selection), invoice, history
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

  const handleCompleteOrder = async (method, formattedText, totalValue, format) => {
    await saveOrder({
      bookerId: user?.id,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      items: cart.map(c => ({ id: c.id, qty: c.qty, discount: c.discount })),
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
    setSelectedCustomerId(customerId);
    setActiveTab('invoice');
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

  return (
    <div className="container">
      {/* Header Sticky Dashboard */}
      <div className="dashboard-header-premium animate-in">
        <div className="flex justify-between items-center w-full">
           <div>
             <h2 className="portal-title">{user?.name} Portal</h2>
             <p className="portal-subtitle">Jazaa Field Operations</p>
           </div>
           <div className="text-right sales-pill">
             <p className="sales-label">Today's Sales</p>
             <p className="sales-amount">Rs. {todaysSales.toLocaleString()}</p>
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
          <CustomerManager onSelect={handleCustomerSelect} />
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
