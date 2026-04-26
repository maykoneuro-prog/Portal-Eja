import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

import PublicPortal from './pages/PublicPortal';
import Registration from './pages/Registration';
import CandidateDashboard from './pages/CandidateDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Login from './pages/Login';
import Navbar from './components/layout/Navbar';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check initial session
    const checkSession = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("Supabase session error:", sessionError);
          setLoading(false);
          return;
        }

        const currentuser = session?.user || null;
        setUser(currentuser);
        
        if (currentuser) {
          try {
            const { data: adminDoc } = await supabase
              .from('admins')
              .select('*')
              .eq('uid', currentuser.id)
              .single();
            
            setIsAdmin(!!adminDoc || currentuser.email === 'maykon.euro@gmail.com' || currentuser.email === 'maykon.euro@hotmail.com');
          } catch (dbErr) {
            console.error("Error checking admin status:", dbErr);
            // Non-critical: allow login even if admin check fails (will just not be admin)
            setIsAdmin(currentuser.email === 'maykon.euro@gmail.com' || currentuser.email === 'maykon.euro@hotmail.com');
          }
        }
      } catch (err) {
        console.error("Critical Auth Initialization Error:", err);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Safety timeout: stop loading after 8 seconds no matter what
    const timer = setTimeout(() => {
      setLoading(false);
    }, 8000);

    // 2. Listen for auth changes
    let subscription: { unsubscribe: () => void } | null = null;
    
    try {
      const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
        const currentuser = session?.user || null;
        setUser(currentuser);
        
        if (currentuser) {
          const { data: adminDoc } = await supabase
            .from('admins')
            .select('*')
            .eq('uid', currentuser.id)
            .single();
          setIsAdmin(!!adminDoc || currentuser.email === 'maykon.euro@gmail.com' || currentuser.email === 'maykon.euro@hotmail.com');
        } else {
          setIsAdmin(false);
        }
        setLoading(false);
      });
      subscription = data.subscription;
    } catch (err) {
      console.error("Error setting up auth change listener:", err);
      setLoading(false);
    }

    return () => {
      clearTimeout(timer);
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sesi-gray">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-sesi-blue border-t-transparent"></div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <Navbar user={user} isAdmin={isAdmin} />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<PublicPortal />} />
            <Route path="/login" element={<Login />} />
            <Route path="/inscricao" element={<Registration />} />
            
            <Route 
              path="/dashboard" 
              element={user ? <CandidateDashboard /> : <Navigate to="/login" />} 
            />
            
            <Route 
              path="/admin/*" 
              element={isAdmin ? <AdminDashboard /> : <Navigate to="/" />} 
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
