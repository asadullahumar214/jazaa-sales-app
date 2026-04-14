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
  const user = getActiveUser();

  const loadData = async () => {
    const invData = await getInventory();
    setLocalInventory(invData);
    
    const custData = await getCustomers();
    setLocalCustomers(custData);
    
    const ordData = await getOrders();
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
    
    const intv = setInterval(loadData, 10000); // 10s polling for Supabase
    return () => clearInterval(intv);
  }, []);

  const selectedCustomer = customers.find(c => String(c.id) === String(selectedCustomerId));

  const addToCart = (product) => {
    if (!selectedCustomer) {
      alert("Please select a customer first.");
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
           alert("Cannot exceed available admin inventory stock!");
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
      // Intelligence for +92 format
      let formattedPhone = phone.replace(/[^0-9]/g, '');
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '92' + formattedPhone.substring(1);
      } else if (formattedPhone.length === 10) {
        formattedPhone = '92' + formattedPhone;
      }
      
      window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(formattedText)}`, '_blank');
    } else {
      const subject = encodeURIComponent(`Invoice: ${selectedCustomer.name}`);
      window.open(`mailto:?subject=${subject}&body=${encodeURIComponent(formattedText)}`);
    }

    setCart([]);
    setSelectedCustomerId('');
    await loadData();
    alert("Order successfully processed and saved to Supabase!");
  };

  const handleCancelOrder = () => {
    setCart([]);
    alert("Order cancelled.");
  };

  const handleCancelPlacedOrder = async (orderId) => {
    const reason = prompt("Please provide a reason for cancellation:\n(e.g. Customer changed mind, Wrong order, Price dispute)");
    if (reason === null) return;
    if (!reason.trim()) {
      alert("Cancellation reason is required.");
      return;
    }

    const orderToCancel = pastOrders.find(o => String(o.id) === String(orderId));

    await cancelOrder(orderId, reason.trim());
    await loadData();

    if (orderToCancel && window.confirm("Order cancelled!\nWould you like to load its items back into your cart for editing?")) {
       const invData = await getInventory();
       const mappedCart = orderToCancel.items.map(item => {
           const inventoryItem = invData.find(i => String(i.id) === String(item.id));
           return { id: item.id, qty: item.qty, product: inventoryItem };
       });
       setCart(mappedCart);
       setSelectedCustomerId(orderToCancel.customerId);
    }
  };

  const filteredInventory = inventory.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  const today = new Date().toLocaleDateString();
  const todaysOrders = pastOrders.filter(o => new Date(o.date).toLocaleDateString() === today && o.status === 'confirmed');
  const todaysSales = todaysOrders.reduce((sum, o) => sum + (o.totalValue || 0), 0);

  return (
    <div className="container">
      <div className="flex justify-between items-center mb-4">
        <h2>Sales Booking app Jazaa - OrderBooker Portal - {user?.name}</h2>
        <div style={{ background: 'var(--primary)', color: 'white', padding: '0.5rem 1rem', borderRadius: '8px' }}>
          <p style={{ fontSize: '0.8rem', margin: 0, opacity: 0.8 }}>Today's Sales</p>
          <p style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: 0 }}>Rs. {todaysSales.toFixed(2)}</p>
        </div>
      </div>
      
      <CustomerManager />

      <div className="card mt-4 mb-4">
        <h3>Step 1: Select or create your customer above</h3>
        <select 
          className="form-select mt-4" 
          value={selectedCustomerId}
          onChange={e => setSelectedCustomerId(e.target.value)}
        >
          <option value="">-- Choose Customer --</option>
          {customers.map(c => (
            <option key={c.id} value={c.id}>
              {c.name} - [{c.type}] {c.type === 'IT' ? `(NTN: ${c.ntn})` : c.type === 'Both' ? `(STRN: ${c.strn})` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card" style={{ maxHeight: '800px', overflowY: 'auto' }}>
          <h3>Step 2: Add Products</h3>
          <input 
            type="text" 
            placeholder="Search allowed inventory..." 
            className="form-input mb-4 mt-4" 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          
          <div className="grid grid-cols-2 gap-4">
            {filteredInventory.map(item => {
               const inCart = cart.find(c => c.id === item.id);
               const isOutOfStock = item.stock <= 0;
               return (
                 <div key={item.id} className="card" style={{ padding: '1rem', background: isOutOfStock ? '#f1f5f9' : '#fff' }}>
                    <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>{item.name}</h4>
                    <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>{item.category}</p>
                    <p style={{ fontWeight: '500', color: isOutOfStock ? 'red' : 'green' }}>
                      Admin Stock: {item.stock}
                    </p>
                    
                    <div className="mt-4">
                      {inCart ? (
                        <div className="flex justify-between items-center" style={{ background: '#f8fafc', padding: '0.5rem', borderRadius: '8px' }}>
                          <button className="btn btn-outline" style={{padding:'0.2rem 0.5rem'}} onClick={() => updateQty(item.id, -1)}>-</button>
                          <span className="font-bold">{inCart.qty}</span>
                          <button className="btn btn-outline" style={{padding:'0.2rem 0.5rem'}} onClick={() => updateQty(item.id, 1)}>+</button>
                        </div>
                      ) : (
                        <button 
                          className="btn btn-primary" 
                          style={{ width: '100%', padding: '0.5rem', opacity: isOutOfStock ? 0.5 : 1 }} 
                          disabled={isOutOfStock}
                          onClick={() => addToCart(item)}
                        >
                          {isOutOfStock ? "Out of Stock" : "Add to Order"}
                        </button>
                      )}
                    </div>
                 </div>
               )
            })}
          </div>
        </div>

        <div>
          {cart.length > 0 && selectedCustomer && settingsObj ? (
            <div>
               <h3>Step 3: Generate & Finalize Invoice</h3>
               <InvoiceGenerator 
                 cart={cart}
                 customer={selectedCustomer}
                 settingsObj={settingsObj}
                 onSend={handleCompleteOrder}
                 onCancel={handleCancelOrder}
               />
            </div>
          ) : (
            <div className="card text-center" style={{ paddingTop: '4rem', paddingBottom: '4rem' }}>
              <p className="text-muted">{!settingsObj ? "Loading tax engine..." : "Cart is empty or no customer selected."}</p>
            </div>
          )}
        </div>
      </div>

      <div className="card mt-4 mb-4">
        <h3>Your Pending Orders</h3>
        <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
          Orders you recently placed. You can cancel them if the shopkeeper changes their mind in the morning.
        </p>
        <div className="table-responsive">
           <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Format</th>
                <th>Total Value</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pastOrders.length === 0 ? (
                <tr><td colSpan="5" className="text-center text-muted">No pending orders found.</td></tr>
              ) : (
                pastOrders.slice().reverse().map(o => ( o &&
                  <tr key={o.id}>
                    <td>{new Date(o.date).toLocaleDateString()}</td>
                    <td>{o.customerName}</td>
                    <td>{o.invoiceFormat || 'TP'}</td>
                    <td className="font-bold">Rs. {o.totalValue?.toFixed(2)}</td>
                    <td>
                      <button className="btn btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', minHeight: '30px' }} onClick={() => handleCancelPlacedOrder(o.id)}>
                        Cancel / Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
