import React, { useState, useEffect } from 'react';
import { getCustomers, setCustomers } from '../store';
import { debounce } from '../utils/debounce';

export default function CustomerManager({ onSelect }) {
  const [customers, setLocalCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newCustomer, setNewCustomer] = useState({ 
    name: '', 
    phone: '', 
    location: '',
    shop_type: 'Kiryana',
    type: 'None', 
    ntn: '', 
    strn: '' 
  });

  useEffect(() => {
    const fetchCusts = async () => {
      const data = await getCustomers();
      setLocalCustomers(data);
    };
    fetchCusts();
    const intv = setInterval(fetchCusts, 10000);
    return () => clearInterval(intv);
  }, []);

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    const newC = { ...newCustomer, id: Date.now().toString() };
    const updated = [...customers, newC];
    
    setLocalCustomers(updated);
    setNewCustomer({ name: '', phone: '', location: '', shop_type: 'Kiryana', type: 'None', ntn: '', strn: '' });
    await setCustomers([newC]);
    
    if (onSelect) {
      onSelect(newC.id);
    }
  };

  const debouncedPhoneUpdate = React.useMemo(
    () => debounce(async (id, newPhone, currentCustomers) => {
      const targetCustomer = currentCustomers.find(c => String(c.id) === String(id));
      if (targetCustomer) {
        await setCustomers([{ ...targetCustomer, phone: newPhone }]);
      }
    }, 1000),
    []
  );

  const handleEditPhone = (id, newPhone) => {
    const updated = customers.map(c => String(c.id) === String(id) ? { ...c, phone: newPhone } : c);
    setLocalCustomers(updated);
    debouncedPhoneUpdate(id, newPhone, updated);
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.phone.includes(searchQuery)
  );

  return (
    <div className="card mt-4 mb-4">
      <div className="flex justify-between items-center mb-6">
        <h3 style={{ margin: 0 }}>Customer Directory</h3>
        <span className="text-xs text-muted">{customers.length} shops saved</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Registration Section */}
        <div style={{ borderRight: '1px solid var(--border)', paddingRight: '1rem' }} className="md:pr-8 pr-0 border-r-0 md:border-r">
          <h4 className="text-sm uppercase text-muted mb-4 font-bold" style={{ fontSize: '0.7rem' }}>Register New Shop</h4>
          <form onSubmit={handleAddCustomer} className="flex flex-col gap-4">
            <div className="form-group">
              <label>Shop / Customer Name</label>
              <input required type="text" className="form-input" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} placeholder="e.g. Asad Store" />
            </div>
            <div className="form-group">
              <label>Mobile Number</label>
              <input required type="text" className="form-input" value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} placeholder="03XXXXXXXXX" />
            </div>

            <div className="form-group">
              <label>Location (Area/City)</label>
              <input required type="text" className="form-input" value={newCustomer.location} onChange={e => setNewCustomer({...newCustomer, location: e.target.value})} placeholder="e.g. DHA Phase 5" />
            </div>

            <div className="form-group">
              <label>Shop Type</label>
              <select className="form-select" value={newCustomer.shop_type} onChange={e => setNewCustomer({...newCustomer, shop_type: e.target.value})}>
                <option value="Kiryana">Kiryana Store</option>
                <option value="Superstore">Superstore</option>
                <option value="Wholesale">Wholesale / Dealer</option>
                <option value="Pharmacy">Pharmacy</option>
                <option value="Other">Other</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Tax Status</label>
              <select className="form-select" value={newCustomer.type} onChange={e => setNewCustomer({...newCustomer, type: e.target.value})}>
                <option value="None">None (Unregistered)</option>
                <option value="IT">IT (Income Tax)</option>
                <option value="Both">Both (IT + STRN)</option>
              </select>
            </div>

            {newCustomer.type === 'IT' && (
              <div className="form-group animate-in">
                <label>NTN Number</label>
                <input required type="text" className="form-input" value={newCustomer.ntn} onChange={e => setNewCustomer({...newCustomer, ntn: e.target.value})} placeholder="Enter NTN" />
              </div>
            )}

            {newCustomer.type === 'Both' && (
              <div className="form-group animate-in">
                <label>STRN Number</label>
                <input required type="text" className="form-input" value={newCustomer.strn} onChange={e => setNewCustomer({...newCustomer, strn: e.target.value})} placeholder="Enter STRN" />
              </div>
            )}

            <button type="submit" className="btn btn-primary w-full py-4 text-lg">
              Create Shop Profile
            </button>
          </form>
        </div>

        {/* Directory Section */}
        <div>
          <div className="flex justify-between items-center mb-4">
             <h4 className="text-sm uppercase text-muted font-bold" style={{ fontSize: '0.7rem' }}>Search Existing</h4>
             <input 
               type="text" 
               className="form-input" 
               style={{ width: '150px', minHeight: '34px', fontSize: '0.8rem' }} 
               placeholder="Filter..." 
               value={searchQuery}
               onChange={e => setSearchQuery(e.target.value)}
             />
          </div>

          <div className="card-list" style={{ maxHeight: '500px', overflowY: 'auto', paddingRight: '5px' }}>
            {filteredCustomers.length === 0 ? (
              <p className="text-center text-muted py-8 text-sm italic">No matching customers found.</p>
            ) : (
              filteredCustomers.slice().reverse().map(c => (
                <div key={c.id} className="card-item" style={{ borderLeft: `4px solid ${c.type === 'Both' ? '#10b981' : c.type === 'IT' ? '#f59e0b' : '#cbd5e1'}` }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="font-bold text-sm" style={{ margin: 0 }}>{c.name}</h5>
                      <p className="text-[10px] text-muted uppercase mt-0.5">
                        📍 {c.location || 'No Location'} • {c.shop_type || 'General'}
                      </p>
                      <p className="text-xs text-blue-600 font-bold uppercase mt-1" style={{ fontSize: '0.65rem' }}>
                        {c.type === 'Both' ? `STRN: ${c.strn}` : c.type === 'IT' ? `NTN: ${c.ntn}` : 'Unregistered'}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.type === 'Both' ? 'bg-green-100 text-green-700' : 'bg-slate-100'}`}>
                      {c.type}
                    </span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1">
                       <span className="text-xs font-bold text-muted">Ph:</span>
                       <input 
                         type="text" 
                         className="form-input" 
                         style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', minHeight: '28px', border: 'none', background: '#f8fafc', width: '100%' }}
                         value={c.phone} 
                         onChange={(e) => handleEditPhone(c.id, e.target.value)} 
                       />
                    </div>
                    {onSelect && (
                      <button 
                        className="btn btn-primary" 
                        style={{ minHeight: '32px', height: '32px', padding: '0 0.75rem', fontSize: '0.75rem' }}
                        onClick={() => onSelect(c.id)}
                      >
                        Book Order
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

