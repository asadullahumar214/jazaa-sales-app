import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setActiveUser, getUsers } from '../store';

export default function Login() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); // Clear previous errors
    try {
      setLoading(true);
      const users = await getUsers();
      const foundUser = users.find(u => u.id === userId && u.password === password);

      if (foundUser) {
          if (!foundUser.is_active) {
              setLoading(false);
              setError("Account Disabled. Please contact the administrator.");
              return;
          }
          setActiveUser(foundUser);
          if (foundUser.role === 'admin') navigate('/admin');
          else navigate('/booker');
      } else {
        setLoading(false);
        setError("Invalid ID or Password.");
      }
    } catch (err) {
      setLoading(false);
      console.error("Login Error:", err);
      setError("System currently unavailable. Please check your connection.");
    }
  };

  return (
    <div className="container" style={{ maxWidth: '400px', marginTop: '10vh' }}>
      <div className="card">
        <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Sales Booking app Jazaa</h2>
        {error && <div className="btn-danger" style={{ padding: '0.5rem', marginBottom: '1rem', borderRadius: '8px' }}>{error}</div>}
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Login ID</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. admin or shan" 
              value={userId}
              onChange={e => setUserId(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input 
              type="password" 
              className="form-input" 
              placeholder="Enter password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%' }}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
