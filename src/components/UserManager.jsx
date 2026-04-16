import React, { useState, useEffect, useMemo } from 'react';
import { getUsers, setUsers, addAuditLog, getOrders } from '../store';

export default function UserManager() {
  const [users, setLocalUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const formatPhone = (val) => {
    const cleaned = ('' + val).replace(/\D/g, '');
    if (cleaned.length <= 4) return cleaned;
    if (cleaned.length <= 11) return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 11)}`;
  };

  const getRelativeTime = (isoString) => {
    if (!isoString) return 'Never';
    const seconds = Math.floor((new Date() - new Date(isoString)) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return new Date(isoString).toLocaleDateString();
  };

  const fetchData = async () => {
    const [u, o] = await Promise.all([getUsers(), getOrders()]);
    setLocalUsers(u);
    setOrders(o);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000); // Refresh every 15s for last seen/performance
    return () => clearInterval(interval);
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      u.id.includes(searchQuery)
    );
  }, [users, searchQuery]);

  const userPerformance = useMemo(() => {
    const perf = {};
    const today = new Date().toLocaleDateString();
    orders.forEach(o => {
      if (o.status === 'confirmed' && new Date(o.date).toLocaleDateString() === today) {
        perf[o.bookerId] = (perf[o.bookerId] || 0) + (o.totalValue || 0);
      }
    });
    return perf;
  }, [orders]);

  const handleCreate = async (e) => {
    e.preventDefault();
    const id = newId.trim().toLowerCase();
    const name = newName.trim();
    
    if (!id || !name || !newPassword) return setError('All fields required');
    if (users.find(u => u.id === id)) return setError(`ID "${id}" exists`);

    setSaving(true);
    const updated = [...users, { 
      id, 
      role: 'orderbooker', 
      name, 
      password: newPassword, 
      is_active: true,
      floor_check_enabled: true,
      stock_check_enabled: true,
      can_cancel_orders: true,
      can_register_shops: true
    }];
    setLocalUsers(updated);
    await setUsers(updated);
    await addAuditLog({ action: 'USER_CREATED', userId: 'admin', details: `Created: ${name} (${id})` });
    setNewId(''); setNewName(''); setNewPassword(''); setError(''); setSaving(false);
  };

  const toggleStatus = async (userId, field) => {
    if (userId === 'admin' && field === 'is_active') return;
    const updated = users.map(u => u.id === userId ? { ...u, [field]: !u[field] } : u);
    setLocalUsers(updated);
    await setUsers(updated);
    
    if (field === 'is_active') {
      const target = updated.find(u => u.id === userId);
      await addAuditLog({ action: target.is_active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', userId: 'admin', details: `${target.name} (${userId})` });
    }
  };

  const deleteUser = async (userId) => {
    if (userId === 'admin') return;
    const target = users.find(u => u.id === userId);
    if (!window.confirm(`Delete "${target.name}"?`)) return;
    const updated = users.filter(u => u.id !== userId);
    setLocalUsers(updated);
    await setUsers(updated);
    await addAuditLog({ action: 'USER_DELETED', userId: 'admin', details: `Deleted: ${target.name} (${userId})` });
  };

  return (
    <div className="card mt-4 mb-4">
      <div className="flex justify-between items-center mb-6">
         <div>
            <h3 className="text-xl font-bold">Staff Management</h3>
            <p className="text-sm text-muted">Manage field access and monitoring.</p>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Creation Form */}
        <div className="lg:col-span-1">
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 sticky top-4">
            <h4 className="text-xs font-bold text-muted uppercase mb-4 tracking-widest">New Staff Account</h4>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
                {error && <div className="p-3 bg-red-100 text-red-700 text-xs rounded-lg border border-red-200 font-bold">{error}</div>}
                <div className="form-group">
                  <label>Login ID / Phone</label>
                  <input required className="form-input" placeholder="03XX-XXXXXXX" value={newId} onChange={e => setNewId(formatPhone(e.target.value))} />
                </div>
                <div className="form-group">
                  <label>Full Name</label>
                  <input required className="form-input" placeholder="e.g. Ahmad Ali" value={newName} onChange={e => setNewName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input required className="form-input" type="text" placeholder="••••••••" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                </div>
                <button type="submit" disabled={saving} className="btn btn-primary py-3 w-full shadow-lg shadow-primary/20">
                  {saving ? 'Creating...' : 'Create Account'}
                </button>
            </form>
          </div>
        </div>

        {/* Staff List */}
        <div className="lg:col-span-2">
           <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
              <h4 className="text-xs font-bold text-muted uppercase tracking-widest">Team Overview ({users.length})</h4>
              <div className="relative w-full md:w-64">
                <input 
                  className="form-input !py-2 !pl-8 text-sm" 
                  placeholder="Search staff..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                <span className="absolute left-3 top-2.5 opacity-30 text-xs">🔍</span>
              </div>
           </div>

           <div className="grid grid-cols-1 gap-4 animate-in">
              {filteredUsers.map(u => (
                <div key={u.id} className={`bg-white border p-5 rounded-2xl transition-all hover:shadow-md ${!u.is_active ? 'bg-slate-50 border-slate-200 grayscale-[0.5]' : 'border-slate-100'}`}>
                   <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${u.is_active ? 'bg-primary/10 text-primary' : 'bg-slate-200 text-slate-500'}`}>
                          {u.name.charAt(0)}
                        </div>
                        <div>
                           <div className="flex items-center gap-2">
                             <p className="font-bold text-slate-900">{u.name}</p>
                             {u.is_active && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]"></span>}
                           </div>
                           <p className="text-xs text-muted font-mono">{u.id} • {u.password}</p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end">
                         <p className="text-[10px] uppercase font-bold text-muted tracking-widest">Today's Sales</p>
                         <p className="text-lg font-black text-slate-800">Rs. {(userPerformance[u.id] || 0).toLocaleString()}</p>
                         <p className="text-[10px] text-muted whitespace-nowrap">Seen: {getRelativeTime(u.last_active)}</p>
                      </div>
                   </div>

                   {u.role !== 'admin' && (
                     <div className="mt-5 pt-5 border-t border-slate-50">
                        <p className="text-[9px] uppercase font-bold text-muted mb-3 tracking-widest">Access Controls</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                            <label className="flex items-center justify-between p-2 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                               <span className="text-[10px] font-bold text-slate-600">Floor Control</span>
                               <input type="checkbox" className="w-4 h-4 accent-primary" checked={u.floor_check_enabled !== false} onChange={() => toggleStatus(u.id, 'floor_check_enabled')} />
                            </label>
                            <label className="flex items-center justify-between p-2 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                               <span className="text-[10px] font-bold text-slate-600">Stock Checks</span>
                               <input type="checkbox" className="w-4 h-4 accent-primary" checked={u.stock_check_enabled !== false} onChange={() => toggleStatus(u.id, 'stock_check_enabled')} />
                            </label>
                            <label className="flex items-center justify-between p-2 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                               <span className="text-[10px] font-bold text-slate-600">Cancel Orders</span>
                               <input type="checkbox" className="w-4 h-4 accent-primary" checked={u.can_cancel_orders !== false} onChange={() => toggleStatus(u.id, 'can_cancel_orders')} />
                            </label>
                            <label className="flex items-center justify-between p-2 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                               <span className="text-[10px] font-bold text-slate-600">Register Shops</span>
                               <input type="checkbox" className="w-4 h-4 accent-primary" checked={u.can_register_shops !== false} onChange={() => toggleStatus(u.id, 'can_register_shops')} />
                            </label>
                        </div>

                        <div className="flex gap-2">
                           <button 
                             className={`btn flex-1 py-1.5 text-[10px] uppercase font-bold tracking-widest ${u.is_active ? 'btn-outline border-slate-200' : 'btn-success'}`} 
                             onClick={() => toggleStatus(u.id, 'is_active')}
                           >
                              {u.is_active ? 'Disable Account' : 'Re-Enable Account'}
                           </button>
                           <button className="btn btn-danger px-4 py-1.5" onClick={() => deleteUser(u.id)}>🗑️</button>
                        </div>
                     </div>
                   )}
                </div>
              ))}
              {filteredUsers.length === 0 && <div className="text-center py-12 text-muted">No staff found matching "{searchQuery}"</div>}
           </div>
        </div>
      </div>
    </div>
  );
}
