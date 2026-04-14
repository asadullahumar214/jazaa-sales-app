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
  // Rescue Loop: Synchronous hydration prevents 1-frame routing flashes
  const [user, setUser] = useState(() => {
    try {
      return getActiveUser();
    } catch (e) {
      console.error("HYDRATION_ERROR:", e);
      return null;
    }
  });

  useEffect(() => {
    console.log("APP_STARTUP: Checking environment and database connection...");
    if (!import.meta.env.VITE_SUPABASE_URL) {
      console.error("CRITICAL_ERROR: Supabase URL is missing from environment variables!");
    }

    initStore();
    setUser(getActiveUser());
    
    // Hardening: Verify account status periodically to force logout if deactivated
    const syncStatus = async () => {
      const active = getActiveUser();
      if (!active) {
        if (user) setUser(null);
        return;
      }
      
      const { data: dbUser } = await supabase.from('users').select('is_active').eq('id', active.id).single();
      if (dbUser && !dbUser.is_active) {
          handleLogout();
      } else {
          setUser(active);
      }
    };

    syncStatus();
    const interval = setInterval(syncStatus, 15000); 
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
