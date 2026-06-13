import React, { useState, useEffect } from 'react';
import { Shield, User, Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { Profile } from '../../types';
import { ApiService } from '../../lib/api';
import AppLogo from '../AppLogo';

interface LoginViewProps {
  onLoginSuccess: (user: Profile) => void;
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [loginMode, setLoginMode] = useState<'guardian' | 'admin'>(() => {
    return (localStorage.getItem('hotel_reviews_last_mode') as 'guardian' | 'admin') || 'guardian';
  });
  const [username, setUsername] = useState(() => {
    const lastUser = localStorage.getItem('hotel_reviews_last_username') || '';
    return lastUser === 'admin' ? '' : lastUser;
  });
  const [password, setPassword] = useState(() => {
    return localStorage.getItem('hotel_reviews_last_password') || '';
  });
  const [showPassword, setShowPassword] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Rate limiting states
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState(0);

  // Handle countdown if locked out
  useEffect(() => {
    if (lockoutTime <= 0) return;
    const interval = setInterval(() => {
      setLockoutTime((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutTime > 0) {
      setError(`Muitas tentativas. Aguarde mais ${lockoutTime} segundos.`);
      return;
    }

    setLoading(true);
    setError(null);

    const loginUser = loginMode === 'admin' ? 'admin' : username;

    try {
      const res = await ApiService.login(loginUser, password);
      
      if (res.error) {
        // Increment fails
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        
        if (newAttempts >= 5) {
          setLockoutTime(30); // 30 seconds wait
          setFailedAttempts(0);
          setError('Acesso bloqueado por 30 segundos devido a tentativas repetidas de login.');
        } else {
          setError(res.error);
        }
      } else if (res.user) {
        // Success
        setFailedAttempts(0);
        
        // Save credentials for silent auto-login on mobile or page reloads
        localStorage.setItem('hotel_reviews_last_username', loginUser);
        localStorage.setItem('hotel_reviews_last_password', password);
        localStorage.setItem('hotel_reviews_last_mode', loginMode);
        localStorage.setItem('hotel_reviews_auto_login_disabled', 'false');

        onLoginSuccess(res.user);
      }
    } catch (err: any) {
      setError('Ocorreu um erro ao processar o login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = (mode: 'guardian' | 'admin') => {
    setLoginMode(mode);
    setPassword('');
    setError(null);
  };

  return (
    <div id="login-layout" className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div id="login-card" className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden flex flex-col">
        
        {/* Top Header graphic */}
        <div className="bg-slate-900 px-6 py-8 text-center relative">
          <div className="absolute top-0 right-0 left-0 bottom-0 opacity-20 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:16px_16px]" />
          
          <div className="mx-auto flex justify-center py-2 relative z-10 mb-2 animate-fade-in">
            <AppLogo size={98} whiteText={true} />
          </div>
          
          <h1 className="font-sans font-black text-xl text-amber-50 tracking-wide relative z-10">
            Guardiões do atendimento
          </h1>
          <p className="text-xs text-slate-400 font-sans tracking-widest uppercase mt-1 relative z-10">
            Portal de Avaliações
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-100 bg-slate-50/50">
          <button
            onClick={() => toggleMode('guardian')}
            id="tab-login-guardian"
            className={`flex-1 py-3.5 text-xs font-semibold uppercase tracking-wider text-center transition-colors border-b-2
              ${loginMode === 'guardian' 
                ? 'border-amber-500 text-slate-900 bg-white' 
                : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            Entrar como Guardião
          </button>
          <button
            onClick={() => toggleMode('admin')}
            id="tab-login-admin"
            className={`flex-1 py-3.5 text-xs font-semibold uppercase tracking-wider text-center transition-colors border-b-2
              ${loginMode === 'admin' 
                ? 'border-amber-500 text-slate-900 bg-white' 
                : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            Entrar como Administrador
          </button>
        </div>

        {/* Form Body */}
        <div className="p-8 flex-1">
          {error && (
            <div id="login-error-alert" className="p-3 bg-red-50 border border-red-100 text-red-800 rounded-xl text-xs mb-6 flex items-start space-x-2.5 shadow-sm">
              <AlertTriangle className="h-4.5 w-4.5 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {loginMode === 'guardian' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Login de Usuário
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointing-events-none text-slate-400">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={lockoutTime > 0}
                    placeholder="ex: aline.recepcao"
                    id="input-login-username"
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg text-sm text-slate-800"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                {loginMode === 'admin' ? 'Senha Administrativa' : 'Senha'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointing-events-none text-slate-400">
                  {loginMode === 'admin' ? <Shield className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={lockoutTime > 0}
                  placeholder={loginMode === 'admin' ? 'Digite a senha do admin' : 'Digite sua senha'}
                  id="input-login-password"
                  className="w-full pl-9 pr-10 py-2 border border-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg text-sm text-slate-800"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {lockoutTime > 0 && (
              <div className="text-center font-mono py-2 text-rose-600 text-xs font-bold bg-rose-50 border border-rose-100 rounded-lg animate-pulse">
                Bloqueado: {lockoutTime}s restantes
              </div>
            )}

            <button
              type="submit"
              id="btn-login-submit"
              disabled={loading || lockoutTime > 0}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 rounded-lg text-sm transition-colors shadow-md mt-6 flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Autenticando...</span>
              ) : (
                <>
                  <span>Acessar Painel</span>
                </>
              )}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
