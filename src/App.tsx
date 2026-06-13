import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, ShieldCheck, Key, Lock, LogOut, LayoutDashboard, 
  Trophy, FolderKanban, Sliders, Play, ClipboardList, Info, Menu
} from 'lucide-react';
import { 
  Profile, Sector, Platform, ReviewInvite, 
  InternalReview, ExternalReviewConfirmation, MonthlyPrize, AuditLog 
} from './types';
import { ApiService, getSessionUser } from './lib/api';
import { supabase, isDemoMode } from './lib/supabase';

// Components
import Sidebar from './components/Sidebar';
import LoginView from './components/views/LoginView';
import DashboardView from './components/views/DashboardView';
import InvitesListView from './components/views/InvitesListView';
import RankingView from './components/views/RankingView';
import UsersConfigView from './components/views/UsersConfigView';
import SectorsConfigView from './components/views/SectorsConfigView';
import PlatformsConfigView from './components/views/PlatformsConfigView';
import PrizesConfigView from './components/views/PrizesConfigView';
import ConciliationConfigView from './components/views/ConciliationConfigView';
import LogsConfigView from './components/views/LogsConfigView';
import PublicFormsView from './components/views/PublicFormsView';
import PointsConfigView from './components/views/PointsConfigView';
import ComplaintsConfigView from './components/views/ComplaintsConfigView';
import BookingListView from './components/views/BookingListView';

export default function App() {
  
  // Custom SPA Routing State
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  
  // Session Authentication state
  const [currentUser, setCurrentUser] = useState<Profile | null>(() => {
    return getSessionUser();
  });

  // Global Relational States
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [invites, setInvites] = useState<ReviewInvite[]>([]);
  const [internalReviews, setInternalReviews] = useState<InternalReview[]>([]);
  const [confirmations, setConfirmations] = useState<ExternalReviewConfirmation[]>([]);
  const [prizes, setPrizes] = useState<MonthlyPrize[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [weights, setWeights] = useState<Record<string, number>>({});

  // Loading and alerts
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [showDemoModeWarning, setShowDemoModeWarning] = useState(false);

  // Dark Mode Theme State
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme_mode') === 'dark';
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('theme_mode', next ? 'dark' : 'light');
      return next;
    });
  };

  // Forced password update state variables
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);

  // Dynamic Route Change Listener
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Silent automatic login using stored last credentials if the session was purged or expired
  useEffect(() => {
    const performSilentAutoLogin = async () => {
      if (currentUser) return; // Already logged in

      const lastUser = localStorage.getItem('hotel_reviews_last_username');
      const lastPass = localStorage.getItem('hotel_reviews_last_password');
      const autoDisabled = localStorage.getItem('hotel_reviews_auto_login_disabled') === 'true';

      if (lastUser && lastPass && !autoDisabled) {
        console.log('Iniciando login automático silencioso para:', lastUser);
        try {
          const res = await ApiService.login(lastUser, lastPass);
          if (res.user) {
            console.log('Login automático concluído com sucesso!');
            setCurrentUser(res.user);
            if (window.location.pathname === '/' || window.location.pathname === '/login') {
              navigate('/dashboard');
            } else {
              triggerRefresh();
            }
          }
        } catch (err) {
          console.warn('Erro durante tentativa de login automático silencioso:', err);
        }
      }
    };
    performSilentAutoLogin();
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  // Triggering Seed Refreshes
  const triggerRefresh = () => {
    setRefreshSeed(prev => prev + 1);
  };

  // Fetch all states based on active user role
  useEffect(() => {
    const loadAllDatabaseStates = async () => {
      try {
        // Validate actual active session token on startup if we have an initialized user
        if (!isDemoMode && supabase && currentUser) {
          const { data: { session } } = await supabase.auth.getSession();
          
          if (!session && currentUser.role !== 'admin') {
            console.warn("Sessão do Supabase expirada. Tentando reautenticar silenciosamente com credenciais do dispositivo...");
            const lastUser = localStorage.getItem('hotel_reviews_last_username');
            const lastPass = localStorage.getItem('hotel_reviews_last_password');
            const autoDisabled = localStorage.getItem('hotel_reviews_auto_login_disabled') === 'true';

            if (lastUser && lastPass && !autoDisabled) {
              const loginRes = await ApiService.login(lastUser, lastPass);
              if (loginRes.user) {
                console.log("Sessão do Supabase restaurada via login automático!");
                setCurrentUser(loginRes.user);
                // Continue load sequence under valid session
              } else {
                console.warn("Falha ao recuperar a sessão expirada. Efetuando logout...");
                await ApiService.logout();
                setCurrentUser(null);
                navigate('/login');
                setLoadingInitial(false);
                return;
              }
            } else {
              console.warn("Sessão do Supabase inválida ou expirada. Efetuando logout...");
              await ApiService.logout();
              setCurrentUser(null);
              navigate('/login');
              setLoadingInitial(false);
              return;
            }
          }
        }

        // Run all API reads in parallel for premium performance and non-blocking experience
        const [
          fetchedSectors,
          fetchedProfiles,
          fetchedPlatforms,
          fetchedInvites,
          fetchedInternal,
          fetchedConfirmations,
          fetchedPrizes,
          fetchedLogs,
          fetchedWeights
        ] = await Promise.all([
          ApiService.getSectors(),
          ApiService.getProfiles(),
          ApiService.getPlatforms(),
          ApiService.getInvites(),
          ApiService.getInternalReviews(),
          ApiService.getConfirmations(),
          ApiService.getPrizes(),
          ApiService.getLogs(),
          ApiService.getWeights()
        ]);

        setSectors(fetchedSectors);
        setProfiles(fetchedProfiles);
        setPlatforms(fetchedPlatforms);
        
        // Deduplicate invites by id to prevent React duplicate key rendering errors
        const uniqueInvites = fetchedInvites.filter((invite, idx, self) => 
          self.findIndex(i => i.id === invite.id) === idx
        );
        setInvites(uniqueInvites);
        
        setInternalReviews(fetchedInternal);
        setConfirmations(fetchedConfirmations);
        setPrizes(fetchedPrizes);
        setLogs(fetchedLogs);
        setWeights(fetchedWeights);

        // Auto update current user fields in case they changed on other sessions
        if (currentUser) {
          const matched = fetchedProfiles.find(p => p.id === currentUser.id);
          if (matched) {
            setCurrentUser(matched);
            localStorage.setItem('lroyale_user_session', JSON.stringify(matched));
          }
        }

      } catch (err) {
        console.error('Failed to load database states:', err);
      } finally {
        setLoadingInitial(false);
      }
    };

    loadAllDatabaseStates();
  }, [refreshSeed, currentUser?.id]);

  const handleLoginSuccess = (user: Profile) => {
    setCurrentUser(user);
    // If we were on /login, move onto dashboard
    if (window.location.pathname === '/' || window.location.pathname === '/login') {
      navigate('/dashboard');
    } else {
      triggerRefresh();
    }
  };

  const handleLogout = () => {
    // Disable auto-login flag so user remains logged out on explicit click
    localStorage.setItem('hotel_reviews_auto_login_disabled', 'true');
    ApiService.logout();
    setCurrentUser(null);
    navigate('/login');
  };

  // Forcing staff password change procedure
  const handleForcedPasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(false);

    if (!currentUser) return;
    if (newPassword.trim().length < 4) {
      setPwdError('Sua nova senha deve possuir pelo menos 4 dígitos para garantir segurança básica.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPwdError('A confirmação não confere com a nova senha digitada.');
      return;
    }

    setPwdLoading(true);

    try {
      // First verify old password by trying to log in
      const checkOriginal = await ApiService.login(currentUser.username, oldPassword);
      if (checkOriginal.error) {
        setPwdError('A senha atual digitada está incorreta.');
        setPwdLoading(false);
        return;
      }

      // Proceed to update password and remove forced flag
      const updated = await ApiService.updateGuardian(currentUser.id, {
        password_old: oldPassword,
        password_new: newPassword,
        must_change_password: false
      });

      setPwdSuccess(true);
      
      // Update session cached
      setCurrentUser(updated);
      localStorage.setItem('lroyale_user_session', JSON.stringify(updated));

      setTimeout(() => {
        setPwdSuccess(false);
        setNewPassword('');
        setOldPassword('');
        setConfirmNewPassword('');
        triggerRefresh();
        navigate('/dashboard');
      }, 1500);

    } catch (err: any) {
      setPwdError(err.message || 'Erro ao redefinir sua senha. Tente mais tarde.');
    } finally {
      setPwdLoading(false);
    }
  };

  // --- PATH ROUTER LOGICS ---

  // Check if target is a guest public routing channel
  const isPublicRoute = currentPath.startsWith('/r/') || currentPath.startsWith('/avaliacao-interna/');
  const publicTokenMatch = useMemo(() => {
    if (currentPath.startsWith('/r/')) {
      return currentPath.replace('/r/', '');
    }
    if (currentPath.startsWith('/avaliacao-interna/')) {
      return currentPath.replace('/avaliacao-interna/', '');
    }
    return null;
  }, [currentPath]);

  // If path is a guest endpoint, render immediately without app layouts!
  if (isPublicRoute && publicTokenMatch) {
    const isInternal = currentPath.startsWith('/avaliacao-interna/');
    return (
      <PublicFormsView 
        token={publicTokenMatch} 
        isInternalFormExplicit={isInternal} 
      />
    );
  }

  // If not logged in & not on guest screen, force Login View
  if (!currentUser) {
    return (
      <LoginView onLoginSuccess={handleLoginSuccess} />
    );
  }

  // If logged in, but must change password on next action! (Disabled per user request)
  if (false && currentUser.must_change_password) {
    return (
      <div id="forced-password-reset-layout" className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden flex flex-col p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="h-10 w-10 bg-amber-500/10 text-amber-600 rounded-lg flex items-center justify-center mx-auto">
              <Key className="h-5 w-5" />
            </div>
            <h2 className="font-sans font-bold text-lg text-slate-800">Definir Nova Senha de Acesso</h2>
            <p className="text-xs text-slate-500">Este é seu primeiro login. Por motivos de compliance e segurança, é obrigatório redefinir sua senha inicial.</p>
          </div>

          {pwdError && (
            <div className="p-2.5 bg-red-50 border border-red-100 text-red-800 rounded-lg text-xs">
              {pwdError}
            </div>
          )}
          {pwdSuccess && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold flex items-center space-x-1.5">
              <ShieldCheck className="h-4 w-4" />
              <span>Senha alterada! Carregando painel...</span>
            </div>
          )}

          <form onSubmit={handleForcedPasswordChangeSubmit} className="space-y-4 text-xs font-semibold">
            <div className="space-y-1">
              <label className="block text-slate-500 uppercase text-[9px] tracking-wider">Sua Senha Atual (Provisória)</label>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Ex provisória"
                className="w-full text-xs p-2.5 border border-slate-200 bg-slate-50 rounded-lg outline-none font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-slate-500 uppercase text-[9px] tracking-wider">Nova Senha Definitiva</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Pelo menos 4 caracteres"
                className="w-full text-xs p-2.5 border border-slate-200 bg-slate-50 rounded-lg outline-none font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-slate-500 uppercase text-[9px] tracking-wider">Confirme Nova Senha</label>
              <input
                type="password"
                required
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Repita a senha digitada"
                className="w-full text-xs p-2.5 border border-slate-200 bg-slate-50 rounded-lg outline-none font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={pwdLoading}
              id="btn-submit-forced-password-reset"
              className="w-full py-2.5 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {pwdLoading ? 'Validando...' : 'Salvar e Acessar Painel'}
            </button>
          </form>

          <button
            onClick={handleLogout}
            className="text-[11px] text-slate-400 hover:text-slate-600 text-center font-semibold uppercase tracking-wider"
          >
            Voltar para o Login
          </button>
        </div>
      </div>
    );
  }

  // Check is admin for blocking dynamic private routes
  const isAdmin = currentUser.role === 'admin';

  // Fallback state loading screen - only block with spinner if logged in but sectors/database is not yet synchronized
  if (loadingInitial && currentUser && sectors.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center space-y-4">
        <div className="animate-spin h-10 w-10 border-4 border-slate-800 border-t-amber-500 rounded-full" />
        <p className="font-sans font-bold text-sm tracking-wide text-amber-50 uppercase">Sincronizando Chaves do Hotel...</p>
      </div>
    );
  }

  // Core Render Views mapping switch
  const renderCurrentView = () => {
    switch (currentPath) {
      
      case '/dashboard':
      case '/':
        return (
          <DashboardView
            user={currentUser}
            sectors={sectors}
            profiles={profiles}
            platforms={platforms}
            invites={invites}
            internalReviews={internalReviews}
            confirmations={confirmations}
            prizes={prizes}
            weights={weights}
            navigate={navigate}
            darkMode={darkMode}
          />
        );

      case '/avaliacoes':
        return (
          <InvitesListView
            user={currentUser}
            sectors={sectors}
            platforms={platforms}
            invites={invites}
            onInviteCreated={(newInv) => {
              // Prepend newly created item directly in memory state for real-time reactivity!
              setInvites(prev => [newInv, ...prev]);
            }}
          />
        );

      case '/ranking':
        return (
          <RankingView
            user={currentUser}
            sectors={sectors}
            profiles={profiles}
            invites={invites}
            weights={weights}
          />
        );

      case '/listagem-booking':
        return (
          <BookingListView />
        );

      // ADMINISTRATIVE ROUTES (ADMIN ONLY - BLOCK SUB-GUARDIANS)
      case '/configuracoes/usuarios':
        if (!isAdmin) { navigate('/dashboard'); return null; }
        return (
          <UsersConfigView
            user={currentUser}
            profiles={profiles}
            sectors={sectors}
            invites={invites}
            onRefresh={triggerRefresh}
          />
        );

      case '/configuracoes/setores':
        if (!isAdmin) { navigate('/dashboard'); return null; }
        return (
          <SectorsConfigView
            sectors={sectors}
            profiles={profiles}
            invites={invites}
            onRefresh={triggerRefresh}
          />
        );

      case '/configuracoes/plataformas':
        if (!isAdmin) { navigate('/dashboard'); return null; }
        return (
          <PlatformsConfigView
            platforms={platforms}
            onRefresh={triggerRefresh}
          />
        );

      case '/configuracoes/reclamacoes':
        if (!isAdmin) { navigate('/dashboard'); return null; }
        return (
          <ComplaintsConfigView
            user={currentUser}
          />
        );

      case '/configuracoes/pontuacao':
        if (!isAdmin) { navigate('/dashboard'); return null; }
        return (
          <PointsConfigView
            weights={weights}
            onRefresh={triggerRefresh}
          />
        );

      case '/configuracoes/premios':
        if (!isAdmin) { navigate('/dashboard'); return null; }
        return (
          <PrizesConfigView
            prizes={prizes}
            sectors={sectors}
            onRefresh={triggerRefresh}
          />
        );

      case '/configuracoes/conciliacao':
        if (!isAdmin) { navigate('/dashboard'); return null; }
        return (
          <ConciliationConfigView
            user={currentUser}
            invites={invites}
            profiles={profiles}
            sectors={sectors}
            platforms={platforms}
            weights={weights}
            onRefresh={triggerRefresh}
          />
        );

      case '/configuracoes/logs':
        if (!isAdmin) { navigate('/dashboard'); return null; }
        return (
          <LogsConfigView
            logs={logs}
            profiles={profiles}
          />
        );

      // Default redirect if path not registered
      default:
        // Handle redirect paths cleanly
        setTimeout(() => navigate('/dashboard'), 0);
        return null;
    }
  };

  const isDemoModeValue = isDemoMode;

  return (
    <div id="hotel-applet-frame" className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row font-sans text-slate-800 dark:text-slate-100 transition-colors duration-200">

      {/* 2. RESPONSIVE SIDEBAR NAVIGATION FRAME */}
      <Sidebar 
        currentPath={currentPath}
        user={currentUser}
        navigate={navigate}
        onLogout={handleLogout}
        isDemo={isDemoModeValue}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
      />

      {/* 3. DYNAMIC WORKSPACE COMPONENT WRAPPER */}
      <div id="view-workspace-wrapper" className="flex-1 min-w-0 p-4 md:p-8 overflow-y-auto h-[100dvh]">
        <div className="max-w-6xl mx-auto pb-20">
          {renderCurrentView()}
        </div>
      </div>

    </div>
  );
}
