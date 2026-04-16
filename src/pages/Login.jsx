import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setActiveUser, getUsers } from '../store';

export default function Login() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const formatPhone = (val) => {
    const cleaned = ('' + val).replace(/\D/g, '');
    if (cleaned.length <= 4) return cleaned;
    if (cleaned.length <= 11) return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 11)}`;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); // Clear previous errors
    try {
      setLoading(true);
      const users = await getUsers();
      const foundUser = users.find(u => (String(u.id) === String(userId) || String(u.phone) === String(userId)) && u.password === password);

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
              placeholder="03XX-XXXXXXX" 
              value={userId}
              onChange={e => setUserId(formatPhone(e.target.value))}
              required
            />
          </div>
          <div className="form-group" style={{ position: 'relative' }}>
            <label>Password</label>
            <input 
              type={showPassword ? "text" : "password"} 
              className="form-input" 
              placeholder="Enter password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
              style={{ position: 'absolute', right: '10px', top: '34px', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {showPassword ? '🐵' : '🙈'}
            </button>
          </div>
          <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%' }}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
