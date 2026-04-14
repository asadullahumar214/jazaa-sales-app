import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { initStore, getActiveUser, setActiveUser } from './store';
import Login from './pages/Login';
import Admin from './pages/Admin';
import OrderBooker from './pages/OrderBooker';
import './index.css';

const ProtectedRoute = ({ children, allowedRole }) => {
  const user = getActiveUser();
  if (!user) return <Navigate to="/login" />;
  if (allowedRole && user.role !== allowedRole) return <Navigate to="/login" />;
  return children;
};

export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    initStore();
    setUser(getActiveUser());
    
    // Listen to local storage changes for same-tab cross-component auth sync
    const interval = setInterval(() => {
      setUser(getActiveUser());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    setActiveUser(null);
    setUser(null);
  };

  return (
    <BrowserRouter>
      {user && (
         <nav className="navbar">
           <div className="font-bold text-xl" style={{ color: 'var(--primary)' }}>
              Sales Booking app Jazaa
           </div>
           <div className="flex gap-4 items-center">
             <span className="text-muted">Welcome, {user.name} ({user.role})</span>
             <button className="btn btn-outline" onClick={handleLogout}>Logout</button>
           </div>
         </nav>
      )}

      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/admin" element={
          <ProtectedRoute allowedRole="admin">
            <Admin />
          </ProtectedRoute>
        } />

        <Route path="/booker" element={
          <ProtectedRoute allowedRole="orderbooker">
            <OrderBooker />
          </ProtectedRoute>
        } />

        <Route path="/" element={
           user ? (user.role === 'admin' ? <Navigate to="/admin" /> : <Navigate to="/booker" />) : <Navigate to="/login" />
        } />
      </Routes>
    </BrowserRouter>
  );
}
