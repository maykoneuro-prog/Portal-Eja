import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { LogOut, User as UserIcon, ShieldCheck } from 'lucide-react';

interface NavbarProps {
  user: any;
  isAdmin: boolean;
}

export default function Navbar({ user, isAdmin }: NavbarProps) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <nav className="bg-sesi-blue-dark text-white shadow-md z-50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-4">
          <div className="w-16 h-10 bg-white rounded flex items-center justify-center font-black text-sesi-blue-dark text-xl shadow-inner">
            SESI
          </div>
          <div className="hidden md:block">
            <h1 className="text-2xl font-black tracking-tight uppercase leading-none">Portal EJA</h1>
            <p className="text-[10px] opacity-80 font-bold tracking-widest uppercase mt-1 italic">Educação de Jovens e Adultos</p>
          </div>
        </Link>

        <div className="flex items-center gap-6">
          {user ? (
            <div className="flex items-center gap-6">
              {isAdmin && (
                <Link 
                  to="/admin" 
                  className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-blue-200 hover:text-white transition-colors border-r border-white/10 pr-4 mr-2"
                >
                  <ShieldCheck size={18} />
                  Painel Admin
                </Link>
              )}
              
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-[9px] uppercase font-black opacity-60">Matrícula Ativa</p>
                  <p className="text-sm font-bold truncate max-w-[150px]">
                    {user.displayName || user.email?.split('@')[0]}
                  </p>
                </div>
                <Link 
                  to="/dashboard" 
                  className="w-10 h-10 bg-sesi-blue border-2 border-white/20 rounded-full flex items-center justify-center font-black hover:bg-blue-600 transition-all active:scale-90"
                >
                  <UserIcon size={20} />
                </Link>
              </div>

              <button 
                onClick={handleLogout}
                className="p-2 opacity-60 hover:opacity-100 transition-opacity"
              >
                <LogOut size={20} />
              </button>
            </div>
          ) : (
            <Link to="/login" className="bg-white text-sesi-blue px-6 py-2 rounded-xl font-black text-sm uppercase tracking-wider hover:bg-blue-50 transition-colors">
              Entrar
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
