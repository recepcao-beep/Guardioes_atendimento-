import React, { useState } from 'react';
import { 
  BarChart3, Award, FileSpreadsheet, Settings, LogOut, 
  Menu, X, Users, FolderKanban, Globe, CalendarRange, 
  HelpCircle, History, ChevronDown, ChevronRight, Star,
  Sun, Moon, Sliders, AlertTriangle
} from 'lucide-react';
import { Profile } from '../types';
import AppLogo from './AppLogo';

interface SidebarProps {
  currentPath: string;
  navigate: (path: string) => void;
  user: Profile | null;
  onLogout: () => void;
  isDemo: boolean;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export default function Sidebar({ currentPath, navigate, user, onLogout, isDemo, darkMode, onToggleDarkMode }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showConfigSubmenu, setShowConfigSubmenu] = useState(
    currentPath.startsWith('/configuracoes')
  );

  const isAdmin = user?.role === 'admin';
  const isExpanded = isOpen || isHovered;

  const menuItems = [
    { name: 'Painel', path: '/dashboard', icon: BarChart3 },
    { name: 'Avaliações', path: '/avaliacoes', icon: Star },
    { name: 'Classificação (Ranking)', path: '/ranking', icon: Award },
    { name: 'Listagem Booking', path: '/listagem-booking', icon: FileSpreadsheet }
  ];

  const adminSublinks = [
    { name: 'Colaboradores', path: '/configuracoes/usuarios', icon: Users },
    { name: 'Setores do hotel', path: '/configuracoes/setores', icon: FolderKanban },
    { name: 'Plataformas links', path: '/configuracoes/plataformas', icon: Globe },
    { name: 'Ocorrências / Reclamações', path: '/configuracoes/reclamacoes', icon: AlertTriangle },
    { name: 'Regras de pontuação', path: '/configuracoes/pontuacao', icon: Sliders },
    { name: 'Prêmios do mês', path: '/configuracoes/premios', icon: CalendarRange },
    { name: 'Conciliação externa', path: '/configuracoes/conciliacao', icon: FileSpreadsheet },
    { name: 'Registros de log', path: '/configuracoes/logs', icon: History },
  ];

  const handleLinkClick = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

  const isActive = (path: string) => currentPath === path;
  const isSubActive = (path: string) => currentPath.startsWith(path);

  return (
    <>
      {/* Mobile Header bar */}
      <div id="mobile-header" className="md:hidden flex items-center justify-between bg-slate-900 text-white px-4 py-2 border-b border-slate-800 shrink-0 sticky top-0 z-30">
        <div className="flex items-center space-x-3">
          <AppLogo size={42} whiteText={true} />
          <span className="font-sans font-extrabold text-base tracking-wide text-amber-50">Guardiões</span>
        </div>
        <button 
          id="btn-toggle-menu"
          onClick={() => setIsOpen(!isOpen)} 
          className="p-2 text-slate-300 hover:text-white focus:outline-none"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          id="sidebar-backdrop"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-slate-950/60 z-40 md:hidden transition-opacity duration-200"
        />
      )}

      {/* Sidebar navigation container */}
      <aside 
        id="sidebar"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`fixed md:sticky top-0 bottom-0 left-0 h-[100dvh] bg-slate-900 border-r border-slate-800 text-slate-300 transition-all duration-300 z-50 md:z-10 flex flex-col justify-between shrink-0 overflow-x-hidden
          ${isOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'}
          ${!isOpen && isHovered ? 'md:w-64' : ''}
          ${!isOpen && !isHovered ? 'md:w-20' : ''}
        `}
      >
        <div className="flex flex-col flex-1 overflow-x-hidden no-scrollbar py-6">
          {/* Brand header / Logo (Hidden on mobile inside side container) */}
          <div className={`hidden md:flex items-center mb-8 shrink-0 transition-all duration-300 ${isExpanded ? 'px-4 space-x-3.5' : 'justify-center px-0'}`}>
            <AppLogo size={isExpanded ? 58 : 46} whiteText={true} />
            <div className={`flex flex-col whitespace-nowrap overflow-hidden transition-all duration-300 ${isExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>
              <span className="font-sans font-extrabold text-base tracking-wide text-amber-50">Guardiões</span>
              <span className="text-[10px] tracking-widest text-amber-400 font-mono uppercase mt-0.5">Gestão Hoteleira</span>
            </div>
          </div>

          {/* Connected User identity card */}
          {user && (
            <div className={`mb-6 transition-all duration-300 ${isExpanded ? 'px-6' : 'px-4'}`}>
              <div className={`bg-slate-800/40 border border-slate-800/60 rounded-xl transition-all duration-300 flex items-center ${isExpanded ? 'p-4 space-x-3' : 'p-2 justify-center'}`}>
                <div className="h-10 w-10 min-w-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-lg font-sans">
                  {user.full_name.charAt(0).toUpperCase()}
                </div>
                <div className={`flex-1 min-w-0 overflow-hidden whitespace-nowrap transition-all duration-300 ${isExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0 block'}`}>
                  <p className="font-medium text-sm text-amber-100 truncate">{user.full_name}</p>
                  <p className="text-[11px] text-slate-400 truncate capitalize">
                    {user.role === 'admin' ? 'Administrador' : 'Guardião'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Nav links list */}
          <nav className={`flex-1 space-y-1 transition-all duration-300 ${isExpanded ? 'px-4' : 'px-3'}`}>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => handleLinkClick(item.path)}
                  id={`nav-link-${item.name.toLowerCase().replace(/[^a-z]/g, '')}`}
                  className={`w-full flex items-center rounded-lg text-sm font-medium transition-colors group
                    ${isExpanded ? 'px-4 py-3 space-x-3' : 'justify-center py-3 px-0'}
                    ${active 
                      ? `bg-amber-500/10 text-amber-400 border-amber-500 ${isExpanded ? 'border-l-2 pl-3.5' : ''}` 
                      : 'hover:bg-slate-800/70 hover:text-slate-100'}
                  `}
                >
                  <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-300'}`} />
                  <span className={`whitespace-nowrap transition-all duration-300 overflow-hidden ${isExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>{item.name}</span>
                </button>
              );
            })}

            {/* Administrador settings section with collapsable nested items */}
            {isAdmin && (
              <div className="pt-2">
                <button
                  onClick={() => {
                    if (!isExpanded) setIsHovered(true);
                    setShowConfigSubmenu(!showConfigSubmenu);
                  }}
                  id="nav-link-configs-toggle"
                  className={`w-full flex items-center rounded-lg text-sm font-medium transition-colors group
                    ${isExpanded ? 'px-4 py-3 justify-between' : 'justify-center py-3 px-0'}
                    ${isSubActive('/configuracoes') 
                      ? 'text-slate-100 bg-slate-800/30' 
                      : 'hover:bg-slate-800/50 hover:text-slate-100'}
                  `}
                >
                  <div className={`flex items-center ${isExpanded ? 'space-x-3' : ''}`}>
                    <Settings className={`h-5 w-5 shrink-0 ${isSubActive('/configuracoes') ? 'text-slate-300' : 'text-slate-400 group-hover:text-slate-300'}`} />
                    <span className={`whitespace-nowrap transition-all duration-300 overflow-hidden ${isExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>Configurações</span>
                  </div>
                  <div className={`transition-all duration-300 ${isExpanded ? 'opacity-100 block w-auto' : 'opacity-0 w-0'}`}>
                    {showConfigSubmenu ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                  </div>
                </button>

                {(showConfigSubmenu && isExpanded) && (
                  <div className="mt-1 space-y-1 border-l border-slate-800 ml-6 pl-4 transition-all duration-300">
                    {adminSublinks.map((sublink) => {
                      const SubIcon = sublink.icon;
                      const active = isActive(sublink.path);
                      return (
                        <button
                          key={sublink.path}
                          onClick={() => handleLinkClick(sublink.path)}
                          id={`nav-sublink-${sublink.name.toLowerCase().replace(/[^a-z]/g, '')}`}
                          className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-md text-xs font-medium transition-colors overflow-hidden
                            ${active 
                              ? 'text-amber-400 font-semibold' 
                              : 'text-slate-400 hover:text-slate-200'}
                          `}
                        >
                          <SubIcon className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-amber-400' : 'text-slate-500'}`} />
                          <span className="whitespace-nowrap truncate">{sublink.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </nav>
        </div>

        {/* Footer actions of logout & indicator metadata */}
        <div className="p-4 border-t border-slate-800 shrink-0">
          {/* Dark Mode toggle option */}
          <button
            onClick={onToggleDarkMode}
            id="btn-toggle-dark-mode"
            className={`w-full flex items-center hover:bg-slate-800/80 rounded-lg text-sm text-slate-400 hover:text-slate-100 transition-colors group mb-2 cursor-pointer 
              ${isExpanded ? 'px-4 py-2.5 justify-between' : 'justify-center py-2.5 px-0'}
            `}
          >
            <div className={`flex items-center ${isExpanded ? 'space-x-3' : ''}`}>
              {darkMode ? (
                <>
                  <Sun className="h-5 w-5 shrink-0 text-amber-400" />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>Tema Claro</span>
                </>
              ) : (
                <>
                  <Moon className="h-5 w-5 shrink-0 text-indigo-400" />
                  <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>Tema Escuro</span>
                </>
              )}
            </div>
            <div className={`transition-all duration-300 ${isExpanded ? 'opacity-100 flex w-auto' : 'opacity-0 w-0 block'}`}>
              <div className={`w-8 h-4 rounded-full p-0.5 transition-colors duration-200 focus:outline-none flex ${darkMode ? 'bg-amber-500 justify-end' : 'bg-slate-700 justify-start'}`}>
                <div className="w-3 h-3 bg-white rounded-full shadow-md" />
              </div>
            </div>
          </button>

          {/* Demo status pills */}
          {isDemo && (
            <div className={`mb-3 transition-all duration-300 ${isExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0 block'}`}>
              <div className="px-3 py-2 bg-slate-800/80 rounded-lg border border-yellow-400/25">
                <p className="text-[10px] text-yellow-400 font-mono tracking-wider font-semibold uppercase animate-pulse leading-none truncate">
                  Demonstração
                </p>
              </div>
            </div>
          )}

          <button
            onClick={onLogout}
            id="btn-sidebar-logout"
            className={`w-full flex items-center hover:bg-red-500/10 hover:text-red-400 rounded-lg text-sm text-slate-400 font-medium transition-colors group cursor-pointer
              ${isExpanded ? 'px-4 py-2.5 space-x-3' : 'justify-center py-2.5 px-0'}
            `}
          >
            <LogOut className="h-5 w-5 shrink-0 text-slate-500 group-hover:text-red-400" />
            <span className={`whitespace-nowrap transition-all duration-300 overflow-hidden ${isExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>Sair do Painel</span>
          </button>
        </div>
      </aside>
    </>
  );
}
