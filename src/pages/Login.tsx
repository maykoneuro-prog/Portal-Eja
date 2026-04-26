import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { LogIn, ShieldCheck, AlertCircle } from 'lucide-react';

const currentYear = new Date().getFullYear();
const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
const months = [
  { v: '01', l: 'Jan' }, { v: '02', l: 'Fev' }, { v: '03', l: 'Mar' },
  { v: '04', l: 'Abr' }, { v: '05', l: 'Mai' }, { v: '06', l: 'Jun' },
  { v: '07', l: 'Jul' }, { v: '08', l: 'Ago' }, { v: '09', l: 'Set' },
  { v: '10', l: 'Out' }, { v: '11', l: 'Nov' }, { v: '12', l: 'Dez' }
];
const years = Array.from({ length: 90 }, (_, i) => String(currentYear - i));

export default function Login() {
  const [cpf, setCpf] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Verifica se já está logado no Supabase ao carregar
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Redireciona baseado no email
        if (session.user.email === 'maykon.euro@gmail.com') {
          navigate('/admin');
        } else {
          navigate('/dashboard');
        }
      }
    });
  }, [navigate]);

  const [resetSent, setResetSent] = useState(false);

  const handleForgotPassword = async () => {
    if (!cpf.includes('@')) {
      setError('Por favor, digite seu e-mail no campo de CPF para recuperar a senha.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cpf, {
        redirectTo: window.location.origin + '/login',
      });
      if (error) throw error;
      setResetSent(true);
      setError('');
    } catch (err: any) {
      setError(`Erro ao enviar recuperação: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterAdmin = async () => {
    if (!cpf.includes('@')) {
      setError('Para registrar como administrador, digite seu e-mail no campo de usuário.');
      return;
    }
    if (birthDay.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase.auth.signUp({
        email: cpf.trim().toLowerCase(),
        password: birthDay,
        options: {
          data: { role: 'admin' }
        }
      });
      if (error) throw error;
      if (data.user) {
        setError('Usuário administrativo registrado com sucesso! Agora você pode tentar entrar.');
      }
    } catch (err: any) {
      setError(`Erro ao registrar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const isOwnerEmail = cpf.includes('@');
      let email = cpf;
      let password = '';

      if (isOwnerEmail) {
        // Se for admin, usamos o cpf (instruído a ser email) e o campo birthDay (que vira senha)
        email = cpf.trim().toLowerCase();
        password = birthDay; 
      } else {
        const cleanCpf = cpf.replace(/\D/g, '');
        email = `${cleanCpf}@eja-sesi.com.br`;
        password = `${birthYear}${birthMonth}${birthDay}`;
      }

      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (loginError) {
        if (loginError.message.includes('Email not confirmed')) {
          setError('E-mail não confirmado. No Dashboard do Supabase (Authentication > Users), clique nos três pontinhos ao lado do seu e-mail e selecione "Confirm User" para ativar sua conta.');
          return;
        }
        if (loginError.message === 'Invalid login credentials') {
          setError('Senha ou E-mail incorretos. Verifique se digitou a senha 12345678 corretamente.');
          return;
        }
        throw loginError;
      }

      if (data.session) {
        const userEmail = data.session.user.email?.toLowerCase() || '';
        
        // 1. Verifica se é um dos emails "super-admin" hardcoded (para segurança inicial)
        const isSuperAdmin = userEmail === 'maykon.euro@hotmail.com' || userEmail === 'maykon.euro@gmail.com';
        
        if (isSuperAdmin || userEmail.endsWith('@admin.com')) {
          navigate('/admin');
          return;
        }

        // 2. Verifica na tabela 'admins' do banco de dados
        const { data: adminRecord } = await supabase
          .from('admins')
          .select('email')
          .eq('email', userEmail)
          .single();

        if (adminRecord) {
          navigate('/admin');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err: any) {
      console.error("Login Error:", err);
      if (err.message === 'Invalid login credentials') {
        setError('Credenciais inválidas. Verifique se o e-mail e a senha estão corretos.');
      } else if (err.message?.includes('Email not confirmed')) {
        setError('E-mail não confirmado. Verifique sua caixa de entrada para ativar a conta.');
      } else {
        setError(err.message || 'Erro ao tentar acessar. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center p-4">
      {!isSupabaseConfigured && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full mb-6 bg-red-50 border-2 border-red-200 p-6 rounded-2xl shadow-lg"
        >
          <div className="flex items-start gap-4">
            <div className="bg-red-500 text-white p-2 rounded-lg">
              <AlertCircle size={24} />
            </div>
            <div>
              <h3 className="text-red-800 font-black uppercase text-sm tracking-tight mb-1">Configuração Necessária</h3>
              <p className="text-red-600 text-xs leading-relaxed font-medium">
                VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não encontradas. 
                Configure-as no menu <strong>Settings</strong> do AI Studio.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <div className="card-sesi p-10 md:p-12 shadow-2xl shadow-blue-100">
          <div className="text-center mb-10">
            <div className="w-20 h-14 bg-sesi-blue-dark rounded-2xl flex items-center justify-center text-white font-black text-2xl mb-6 mx-auto shadow-inner">
              SESI
            </div>
            <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight">Portal do Aluno</h1>
            <p className="text-slate-500 font-medium mt-2">Acesse sua matrícula e documentos</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="label-sesi">CPF do Aluno ou E-mail (Admin)</label>
              <div className="relative">
                <LogIn className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text"
                  placeholder={cpf.includes('@') ? "exemplo@email.com" : "000.000.000-00"}
                  className="input-sesi pl-12 h-14"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="label-sesi mb-0">
                  {cpf.includes('@') ? 'Sua Senha Administrativa' : 'Data de Nascimento (Senha)'}
                </label>
                {cpf.includes('@') && (
                  <button 
                    type="button" 
                    onClick={handleForgotPassword}
                    className="text-xs text-sesi-blue font-bold hover:underline"
                  >
                    Esqueci minha senha
                  </button>
                )}
              </div>
              
              {cpf.includes('@') ? (
                <input 
                  type="password"
                  placeholder="Digite sua senha"
                  className="input-sesi h-14"
                  value={birthDay}
                  onChange={(e) => setBirthDay(e.target.value)}
                  required
                />
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <select 
                    required
                    value={birthDay} 
                    onChange={(e) => setBirthDay(e.target.value)}
                    className="input-sesi text-xs px-1"
                  >
                    <option value="">Dia</option>
                    {days.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <select 
                    required
                    value={birthMonth} 
                    onChange={(e) => setBirthMonth(e.target.value)}
                    className="input-sesi text-xs px-1"
                  >
                    <option value="">Mês</option>
                    {months.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                  </select>
                  <select 
                    required
                    value={birthYear} 
                    onChange={(e) => setBirthYear(e.target.value)}
                    className="input-sesi text-xs px-1"
                  >
                    <option value="">Ano</option>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              )}
            </div>

            {resetSent && (
              <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm font-medium flex items-center gap-2 border border-green-200">
                <ShieldCheck size={18} />
                E-mail de recuperação enviado! Verifique sua caixa de entrada.
              </div>
            )}

            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs font-black uppercase text-center border border-red-100 italic">
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full btn-sesi-primary py-5 text-xl flex items-center justify-center gap-3 transition-transform active:scale-95"
            >
              {loading ? <span className="animate-pulse">Acessando...</span> : 'ENTRAR NO PORTAL'}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-slate-50 text-center space-y-4">
            <div>
              <p className="text-sm text-slate-400 font-bold mb-4 uppercase tracking-widest">Ainda não tem conta?</p>
              <Link to="/inscricao" className="btn-sesi-secondary w-full py-4 uppercase tracking-widest text-xs">
                Quero me inscrever
              </Link>
            </div>

            <button 
              onClick={() => setCpf('maykon.euro@hotmail.com')}
              className="flex items-center justify-center gap-2 text-slate-400 hover:text-sesi-blue transition-colors text-[10px] font-black uppercase tracking-widest mx-auto"
            >
              <ShieldCheck size={14} />
              Acesso Administrativo (E-mail)
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
