import React, { useState, useEffect } from 'react';
import { getUsers, setUsers, addAuditLog } from '../store';

export default function UserManager() {
  const [users, setLocalUsers] = useState([]);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const u = await getUsers();
      setLocalUsers(u);
    };
    fetch();
  }, []);

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
      stock_check_enabled: true
    }];
    setLocalUsers(updated);
    await setUsers(updated);
    await addAuditLog({ action: 'USER_CREATED', userId: 'admin', details: `Created: ${name} (${id})` });
    setNewId(''); setNewName(''); setNewPassword(''); setError(''); setSaving(false);
  };

  const toggleActive = async (userId) => {
    if (userId === 'admin') return;
    const updated = users.map(u => u.id === userId ? { ...u, is_active: !u.is_active } : u);
    setLocalUsers(updated);
    await setUsers(updated);
    const target = updated.find(u => u.id === userId);
    await addAuditLog({ action: target.is_active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', userId: 'admin', details: `${target.name} (${userId})` });
  };

  const toggleGuardrail = async (userId, field) => {
    const updated = users.map(u => u.id === userId ? { ...u, [field]: !u[field] } : u);
    setLocalUsers(updated);
    await setUsers(updated);
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
      <div className="mb-6">
         <h3 className="text-xl font-bold">User Management</h3>
         <p className="text-sm text-muted">Control access for field staff.</p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Form */}
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
           <h4 className="text-xs font-bold text-muted uppercase mb-4">Create OrderBooker</h4>
           <form onSubmit={handleCreate} className="flex flex-col gap-4">
              {error && <div className="p-3 bg-red-100 text-red-700 text-xs rounded-lg border border-red-200 font-bold">{error}</div>}
              <div className="form-group"><label>Login ID</label><input required className="form-input" placeholder="e.g. jaza_01" value={newId} onChange={e => setNewId(e.target.value)} /></div>
              <div className="form-group"><label>Name</label><input required className="form-input" placeholder="e.g. Ahmad Ali" value={newName} onChange={e => setNewName(e.target.value)} /></div>
              <div className="form-group"><label>Password</label><input required className="form-input" placeholder="••••••••" value={newPassword} onChange={e => setNewPassword(e.target.value)} /></div>
              <button type="submit" disabled={saving} className="btn btn-primary py-3">{saving ? 'Processing...' : 'Add Account'}</button>
           </form>
        </div>

        {/* List */}
        <div className="animate-in">
           <h4 className="text-xs font-bold text-muted uppercase mb-4">Active Staff Accounts</h4>
           <div className="card-list">
              {users.map(u => (
                <div key={u.id} className={`card-item ${!u.is_active ? 'opacity-60 grayscale' : ''}`}>
                   <div className="flex justify-between items-start mb-3">
                      <div>
                         <p className="font-bold text-sm">{u.name}</p>
                         <p className="text-xs text-muted">ID: {u.id} • Pass: {u.password}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                         {u.role.toUpperCase()}
                      </span>
                   </div>
                    {u.role !== 'admin' && (
                      <div className="flex flex-col gap-3 border-t border-slate-50 pt-3 mt-1">
                         <div className="flex gap-4">
                            <label className="flex items-center gap-2 text-[10px] font-bold cursor-pointer">
                               <input type="checkbox" checked={u.floor_check_enabled !== false} onChange={() => toggleGuardrail(u.id, 'floor_check_enabled')} />
                               Enforce Floor
                            </label>
                            <label className="flex items-center gap-2 text-[10px] font-bold cursor-pointer">
                               <input type="checkbox" checked={u.stock_check_enabled !== false} onChange={() => toggleGuardrail(u.id, 'stock_check_enabled')} />
                               Enforce Stock
                            </label>
                         </div>
                         <div className="flex gap-2">
                            <button className={`btn flex-1 text-xs py-2 ${u.is_active ? 'btn-secondary' : 'btn-outline'}`} onClick={() => toggleActive(u.id)}>
                               {u.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button className="btn btn-danger text-xs px-3" onClick={() => deleteUser(u.id)}>🗑️</button>
                         </div>
                      </div>
                    )}
                </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
}
