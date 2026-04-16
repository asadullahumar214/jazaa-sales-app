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

  const [isAddingNew, setIsAddingNew] = useState(false);

  const formatPhone = (val) => {
    // Remove all non-digits
    const cleaned = ('' + val).replace(/\D/g, '');
    if (cleaned.length <= 4) return cleaned;
    if (cleaned.length <= 11) return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 11)}`;
  };

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
    setIsAddingNew(false);
    
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
    const formatted = formatPhone(newPhone);
    const updated = customers.map(c => String(c.id) === String(id) ? { ...c, phone: formatted } : c);
    setLocalCustomers(updated);
    debouncedPhoneUpdate(id, formatted, updated);
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.phone.includes(searchQuery)
  );

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const canRegister = user.role === 'admin' || user.can_register_shops !== false;

  // If adding new, show the form
  if (isAddingNew && canRegister) {
    return (
      <div className="card mt-4 mb-4 animate-in">
        <div className="flex justify-between items-center mb-6">
          <h3 style={{ margin: 0 }}>Register New Shop</h3>
          <button className="btn btn-secondary" onClick={() => setIsAddingNew(false)}>Back to Search</button>
        </div>
        
        <form onSubmit={handleAddCustomer} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="form-group">
            <label>Shop / Customer Name</label>
            <input required type="text" className="form-input" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} placeholder="e.g. Asad Store" />
          </div>
          <div className="form-group">
            <label>Mobile Number</label>
            <input 
              required 
              type="text" 
              className="form-input" 
              value={newCustomer.phone} 
              onChange={e => setNewCustomer({...newCustomer, phone: formatPhone(e.target.value)})} 
              placeholder="03XX-XXXXXXX" 
            />
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

          <div className="md:col-span-2 mt-4">
            <button type="submit" className="btn btn-primary w-full py-4 text-lg">
              Create & Proceed to Order
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Search-First Main View
  return (
    <div className="card mt-4 mb-4 premium-card">
      <div className="text-center mb-8">
        <h2 className="portal-title" style={{ fontSize: '1.8rem' }}>Select Shop</h2>
        <p className="portal-subtitle">Search results will appear automatically</p>
      </div>

      <div className="max-w-2xl mx-auto">
        <div className="relative mb-8">
          <span className="absolute left-5 top-1/2 -translate-y-1/2 text-muted" style={{ fontSize: '1.2rem' }}>🔍</span>
          <input 
            type="text" 
            className="form-input" 
            style={{ paddingLeft: '3.5rem', height: '64px', fontSize: '1.1rem', borderRadius: '18px', boxShadow: 'var(--shadow)' }} 
            placeholder="Type name or phone (e.g. 0300-123)..." 
            value={searchQuery}
            onChange={e => {
              const val = e.target.value;
              if (val.startsWith('03')) setSearchQuery(formatPhone(val));
              else setSearchQuery(val);
            }}
            autoFocus
          />
        </div>

        <div className="card-list" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {/* Always show "Add New" if there's a search query */}
          {searchQuery && canRegister && (
             <div 
              className="card-item animate-in" 
              style={{ border: '2px dashed var(--primary-light)', background: 'rgba(59, 130, 246, 0.05)', cursor: 'pointer', textAlign: 'center', padding: '1.5rem' }}
              onClick={() => {
                setNewCustomer({...newCustomer, name: searchQuery});
                setIsAddingNew(true);
              }}
            >
              <span className="font-bold" style={{ color: 'var(--primary)' }}>+ Register New: "{searchQuery}"</span>
            </div>
          )}

          {filteredCustomers.length === 0 && !searchQuery ? (
            <div className="text-center py-12">
               <p className="text-muted italic mb-4">Recent shops will appear here</p>
               {canRegister && <button className="btn btn-primary" onClick={() => setIsAddingNew(true)}>Register New Shop</button>}
            </div>
          ) : (
            filteredCustomers.slice().reverse().map(c => (
              <div 
                key={c.id} 
                className="card-item flex justify-between items-center" 
                style={{ cursor: 'pointer', borderLeft: `6px solid ${c.type === 'Both' ? '#059669' : c.type === 'IT' ? '#f59e0b' : '#cbd5e1'}` }}
                onClick={() => onSelect(c.id)}
              >
                <div className="flex-1">
                  <h5 className="portal-title" style={{ margin: 0 }}>{c.name}</h5>
                  <div className="flex gap-4 mt-1">
                    <span className="text-xs text-muted font-medium">📍 {c.location || 'General'}</span>
                    <span className="text-xs text-muted font-medium">🏢 {c.shop_type}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${c.type === 'Both' ? 'bg-green-50 text-green-700' : 'bg-slate-50 text-slate-500'}`}>
                      {c.type === 'Both' ? 'STRN + IT' : c.type === 'IT' ? 'INCOME TAX' : 'UNREGISTERED'}
                    </span>
                    <span className="text-[10px] font-bold text-blue-600 font-mono tracking-tight">{c.phone}</span>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div style={{ color: 'var(--primary-light)', fontSize: '1.2rem', opacity: 0.5 }}>→</div>
                  <button 
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (window.confirm(`Mark ${c.name} as visited without order?`)) {
                        const user = JSON.parse(localStorage.getItem('user') || '{}');
                        const { logVisit } = await import('../store');
                        await logVisit({ userId: user.id, customerName: c.name });
                        alert("Visit logged successfully.");
                      }
                    }}
                    className="btn btn-outline text-[10px] p-1 border-slate-200 text-slate-400 hover:border-primary hover:text-primary"
                    style={{ minHeight: '24px', whiteSpace: 'nowrap' }}
                  >
                    📍 Mark Visited
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

