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
    
    if (!id || !name || !newPassword) {
      setError('ID, Name, and Password are required.');
      return;
    }
    if (users.find(u => u.id === id)) {
      setError(`User ID "${id}" already exists.`);
      return;
    }

    setSaving(true);
    const newUser = { id, role: 'orderbooker', name, password: newPassword, is_active: true };
    const updated = [...users, newUser];
    
    setLocalUsers(updated);
    await setUsers(updated);

    await addAuditLog({
      action: 'USER_CREATED',
      userId: 'admin',
      details: `Created OrderBooker account: ${name} (${id})`
    });

    setNewId('');
    setNewName('');
    setNewPassword('');
    setError('');
    setSaving(false);
  };

  const toggleActive = async (userId) => {
    if (userId === 'admin') return; // Cannot deactivate admin
    const updated = users.map(u => 
      u.id === userId ? { ...u, is_active: !u.is_active } : u
    );
    
    setLocalUsers(updated);
    await setUsers(updated);

    const targetUser = updated.find(u => u.id === userId);
    await addAuditLog({
      action: targetUser.is_active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      userId: 'admin',
      details: `${targetUser.is_active ? 'Activated' : 'Deactivated'} user: ${targetUser.name} (${userId})`
    });
  };

  const deleteUser = async (userId) => {
    if (userId === 'admin') return;
    const targetUser = users.find(u => u.id === userId);
    if (!window.confirm(`Are you sure you want to delete "${targetUser.name}"?`)) return;
    
    const updated = users.filter(u => u.id !== userId);
    
    setLocalUsers(updated);
    await setUsers(updated);

    await addAuditLog({
      action: 'USER_DELETED',
      userId: 'admin',
      details: `Deleted user: ${targetUser.name} (${userId})`
    });
  };

  return (
    <div className="card mt-4 mb-4">
      <h3>👥 User Management</h3>
      <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
        Create and manage OrderBooker accounts. Deactivated accounts cannot log in.
      </p>

      <div className="grid grid-cols-2 gap-4 mt-4">
        {/* Create New User Form */}
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          {error && (
            <div style={{ 
              padding: '0.75rem', 
              background: 'rgba(239, 68, 68, 0.1)', 
              border: '1px solid var(--danger)',
              borderRadius: '8px', 
              color: 'var(--danger)', 
              fontSize: '0.85rem' 
            }}>
              {error}
            </div>
          )}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Login ID</label>
            <input 
              required 
              type="text" 
              className="form-input" 
              placeholder="e.g. ob2, ob3..."
              value={newId}
              onChange={e => setNewId(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Display Name</label>
            <input 
              required 
              type="text" 
              className="form-input" 
              placeholder="e.g. Order Booker 2"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Password</label>
            <input 
              required 
              type="text" 
              className="form-input" 
              placeholder="e.g. secret123"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
            />
          </div>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? 'Creating...' : 'Create OrderBooker'}
          </button>
        </form>

        {/* Users Table */}
        <div className="table-responsive" style={{ maxHeight: '350px', overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Password</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ opacity: u.is_active ? 1 : 0.5 }}>
                  <td style={{ fontWeight: 500 }}>{u.id}</td>
                  <td>{u.name}</td>
                  <td><code style={{ background: '#eee', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>{u.password || '—'}</code></td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '99px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: u.role === 'admin' ? 'rgba(37, 99, 235, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      color: u.role === 'admin' ? 'var(--primary)' : 'var(--secondary)'
                    }}>
                      {u.role === 'admin' ? 'Admin' : 'OrderBooker'}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: u.is_active ? 'var(--secondary)' : 'var(--danger)',
                      marginRight: '0.4rem'
                    }}></span>
                    {u.is_active ? 'Active' : 'Disabled'}
                  </td>
                  <td>
                    {u.role !== 'admin' && (
                      <div className="flex gap-4" style={{ gap: '0.5rem' }}>
                        <button 
                          className={`btn ${u.is_active ? 'btn-outline' : 'btn-secondary'}`}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', minHeight: '32px' }}
                          onClick={() => toggleActive(u.id)}
                        >
                          {u.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button 
                          className="btn btn-danger"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', minHeight: '32px' }}
                          onClick={() => deleteUser(u.id)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                    {u.role === 'admin' && (
                      <span className="text-muted" style={{ fontSize: '0.8rem' }}>Protected</span>
                    )}
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
