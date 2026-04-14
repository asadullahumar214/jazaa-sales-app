import { getCustomers, setCustomers } from '../store';
import { debounce } from '../utils/debounce';

export default function CustomerManager() {
  const [customers, setLocalCustomers] = useState([]);
  const [newCustomer, setNewCustomer] = useState({ 
    name: '', 
    phone: '', 
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
    
    // Optimistic UI
    setLocalCustomers(updated);
    setNewCustomer({ name: '', phone: '', type: 'None', ntn: '', strn: '' });

    await setCustomers([newC]); // Upsert only the new customer
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
    setLocalCustomers(updated); // Instant UI update
    debouncedPhoneUpdate(id, newPhone, updated); // Debounced DB update
  };

  return (
    <div className="card mt-4 mb-4">
      <h3>Store & Customer Management</h3>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <form onSubmit={handleAddCustomer} className="flex flex-col gap-4">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Shop / Customer Name</label>
            <input required type="text" className="form-input" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} placeholder="e.g. Asad Store" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Mobile Number</label>
            <input required type="text" className="form-input" value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} placeholder="03XXXXXXXXX" />
          </div>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Tax Type</label>
            <select className="form-select" value={newCustomer.type} onChange={e => setNewCustomer({...newCustomer, type: e.target.value})}>
              <option value="None">None (Unregistered)</option>
              <option value="IT">IT (Income Tax)</option>
              <option value="Both">Both (IT + STRN)</option>
            </select>
          </div>

          {newCustomer.type === 'IT' && (
            <div className="form-group animate-in" style={{ marginBottom: 0 }}>
              <label>NTN Number</label>
              <input required type="text" className="form-input" value={newCustomer.ntn} onChange={e => setNewCustomer({...newCustomer, ntn: e.target.value})} placeholder="Enter NTN" />
            </div>
          )}

          {newCustomer.type === 'Both' && (
            <div className="form-group animate-in" style={{ marginBottom: 0 }}>
              <label>STRN Number</label>
              <input required type="text" className="form-input" value={newCustomer.strn} onChange={e => setNewCustomer({...newCustomer, strn: e.target.value})} placeholder="Enter STRN" />
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>Create Customer Profile</button>
        </form>

        <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Customer Details</th>
                <th>Type</th>
                <th>Tax ID</th>
                <th>Phone</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.id}>
                  <td>
                    <span style={{ fontWeight: 600 }}>{c.name}</span>
                  </td>
                  <td>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      background: c.type === 'Both' ? '#dcfce7' : c.type === 'IT' ? '#fef9c3' : '#f1f5f9',
                      color: c.type === 'Both' ? '#166534' : c.type === 'IT' ? '#854d0e' : '#475569',
                      padding: '2px 8px',
                      borderRadius: '99px',
                      fontWeight: 600
                    }}>
                      {c.type}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>
                    {c.type === 'IT' ? `NTN: ${c.ntn || 'N/A'}` : c.type === 'Both' ? `STRN: ${c.strn || 'N/A'}` : '—'}
                  </td>
                  <td>
                    <input 
                      type="text" 
                      className="form-input" 
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', minHeight: '32px', width: '120px' }}
                      value={c.phone} 
                      onChange={(e) => handleEditPhone(c.id, e.target.value)} 
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

