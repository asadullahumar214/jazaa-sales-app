import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { initStore, getActiveUser, setActiveUser, supabase } from './store';
import Login from './pages/Login';
import Admin from './pages/Admin';
import OrderBooker from './pages/OrderBooker';


const ProtectedRoute = ({ children, allowedRole }) => {
  const user = getActiveUser();
  if (!user) return <Navigate to="/login" />;
  if (allowedRole && user.role !== allowedRole) return <Navigate to="/login" />;
  return children;
};

const APP_VERSION = "2.2.0";

export default function App() {
  const [themeColor, setThemeColor] = useState('#2563eb');
  const [isOnline, setIsOnline] = useState(true);
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
    
    // Theme Sync
    const fetchTheme = async () => {
       const { data } = await supabase.from('settings').select('config').eq('id', true).single();
       if (data?.config?.primary_color) {
          setThemeColor(data.config.primary_color);
       }
    };
    fetchTheme();

    // Heartbeat - Check network status
    const checkNetwork = async () => {
       try {
         const { error } = await supabase.from('settings').select('id').limit(1);
         setIsOnline(!error);
       } catch (e) {
         setIsOnline(false);
       }
    };
    checkNetwork();
    const networkInterval = setInterval(checkNetwork, 30000);

    const interval = setInterval(syncStatus, 15000); 
    return () => {
      clearInterval(interval);
      clearInterval(networkInterval);
    };
  }, []);

  const handleLogout = () => {
    setActiveUser(null);
    setUser(null);
  };

  return (
    <BrowserRouter>
      {user && (
          <nav className="navbar">
            <div className="font-bold text-xl" style={{ color: 'var(--primary)', textTransform: 'capitalize' }}>
               Jazaa sales booking
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
      
      <style>{`
        :root {
          --primary: ${themeColor};
          --primary-light: ${themeColor}22;
        }
      `}</style>

      <footer className="p-4 text-center text-[10px] text-slate-400 opacity-50 uppercase tracking-widest fixed bottom-0 w-full pointer-events-none flex items-center justify-center gap-2">
        <span style={{ 
          width: '6px', 
          height: '6px', 
          borderRadius: '50%', 
          background: isOnline ? '#22c55e' : '#ef4444',
          display: 'inline-block',
          boxShadow: isOnline ? '0 0 4px #22c55e' : '0 0 4px #ef4444',
          transition: 'all 0.3s ease'
        }}></span>
        Jazaa Sales App v{APP_VERSION}
      </footer>
    </BrowserRouter>
  );
}
