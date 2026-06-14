import React, { useState, useMemo } from 'react';
import { 
  Plus, Calendar, Phone, PhoneCall, AlertCircle, Sparkles, Send, CheckCircle2, QrCode,
  Clock, XCircle, Search, Edit3
} from 'lucide-react';
import { Platform, ReviewInvite, Sector, Profile } from '../../types';
import QRGeneratorModal from '../QRGeneratorModal';
import { ApiService } from '../../lib/api';

// High-fidelity brand logos rendered dynamically using official, high-resolution vector assets
const GoogleLogoSvg = () => (
  <img 
    src="https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg" 
    className="h-8 sm:h-9 w-auto object-contain select-none opacity-90 group-hover:opacity-100 transition-opacity" 
    referrerPolicy="no-referrer" 
    alt="Google" 
  />
);

const TripAdvisorLogoSvg = () => (
  <svg viewBox="0 0 160 40" className="h-8 sm:h-9 w-auto select-none" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(0, 4)">
      {/* Official TripAdvisor green background bubble */}
      <circle cx="16" cy="16" r="16" fill="#00AA6C" />
      {/* Owl face contours in pure white */}
      <circle cx="10.5" cy="16" r="5" fill="#FFFFFF" />
      <circle cx="21.5" cy="16" r="5" fill="#FFFFFF" />
      {/* Pupils in TripAdvisor black */}
      <circle cx="11" cy="16" r="2" fill="#000000" />
      <circle cx="21" cy="16" r="2" fill="#000000" />
      {/* Center beak contours */}
      <path d="M14.5 16.5 L17.5 16.5 L16 19.5 Z" fill="#000000" />
      {/* Friendly eyebrow arcs */}
      <path d="M7.5 10 C9 9 11 9.5 12 10.5" stroke="#FFFFFF" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M24.5 10 C23 9 21 9.5 20 10.5" stroke="#FFFFFF" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </g>
    {/* Typographic companion adapts elegantly to Dark & Light themes */}
    <text x="38" y="27" fontFamily="'Inter', system-ui, -apple-system, sans-serif" fontWeight="900" fontSize="19" className="fill-slate-900 dark:fill-white font-black" letterSpacing="-0.5">
      Tripadvisor
    </text>
  </svg>
);

const BookingLogoSvg = () => (
  <img 
    src="https://upload.wikimedia.org/wikipedia/commons/b/be/Booking.com_logo.svg" 
    className="h-6 sm:h-7 w-auto object-contain select-none opacity-90 group-hover:opacity-100 transition-opacity" 
    referrerPolicy="no-referrer" 
    alt="Booking.com" 
  />
);

const MyHotelLogoSvg = () => (
  <svg viewBox="0 0 160 40" className="h-[2.4rem] sm:h-[2.6rem] w-auto select-none" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(10, 8)">
      {/* "my" in bright sky-blue */}
      <text 
        x="0" 
        y="21" 
        fontFamily="'Inter', system-ui, -apple-system, sans-serif" 
        fontWeight="bold" 
        fontSize="24" 
        fill="#1198db" 
        className="font-bold font-sans"
        letterSpacing="-0.05em"
      >
        my
      </text>
      {/* "Hotel" in dark slate which adapts dynamically via darkMode CSS */}
      <text 
        x="32" 
        y="21" 
        fontFamily="'Inter', system-ui, -apple-system, sans-serif" 
        fontWeight="500" 
        fontSize="24" 
        className="fill-slate-800 dark:fill-white font-medium font-sans"
        letterSpacing="-0.03em"
      >
        Hotel
      </text>
    </g>
  </svg>
);

interface InvitesListViewProps {
  user: Profile;
  sectors: Sector[];
  platforms: Platform[];
  invites: ReviewInvite[];
  onInviteCreated: (invite: ReviewInvite) => void;
  onInviteUpdated?: (invite: ReviewInvite) => void;
}

export default function InvitesListView({
  user, sectors, platforms, invites, onInviteCreated, onInviteUpdated
}: InvitesListViewProps) {
  
  const [selectedPlatformForModal, setSelectedPlatformForModal] = useState<Platform | null>(null);
  const [activeTab, setActiveTab ] = useState<'pending' | 'approved' | 'invalidated'>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // States for editing invite guest details
  const [editingGuestInvite, setEditingGuestInvite] = useState<ReviewInvite | null>(null);
  const [editGuestName, setEditGuestName] = useState('');
  const [editRoomNumber, setEditRoomNumber] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const startEditingGuest = (invite: ReviewInvite) => {
    setEditingGuestInvite(invite);
    setEditGuestName(invite.guest_name || '');
    setEditRoomNumber(invite.room_number || '');
  };

  const handleSaveGuestEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGuestInvite) return;
    if (!editGuestName.trim() || !editRoomNumber.trim()) {
      alert('Por favor, preencha o Nome e o Apartamento.');
      return;
    }
    setIsSavingEdit(true);
    try {
      const res = await ApiService.updateInviteGuest(editingGuestInvite.id, editGuestName.trim(), editRoomNumber.trim());
      if (res.error) {
        alert(`Erro ao salvar alterações: ${res.error}`);
      } else if (res.invite) {
        if (onInviteUpdated) {
          onInviteUpdated(res.invite);
        }
        setEditingGuestInvite(null);
      }
    } catch (err: any) {
      console.error(err);
      alert('Falha ao atualizar dados. Tente novamente.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Scope invites based on permissions first (non-admin views only their own links)
  const scopedInvites = useMemo(() => {
    let result = [...invites];
    if (user.role !== 'admin') {
      result = result.filter(i => i.issuer_user_id === user.id);
    }
    return result;
  }, [invites, user]);

  // Split calculations matching the requested division tabs
  const pendingInvites = useMemo(() => {
    return scopedInvites.filter(inv => ['emitted', 'opened'].includes(inv.status));
  }, [scopedInvites]);

  const approvedInvites = useMemo(() => {
    return scopedInvites.filter(inv => ['externally_verified_manual', 'externally_reconciled', 'internal_completed'].includes(inv.status));
  }, [scopedInvites]);

  const invalidatedInvites = useMemo(() => {
    return scopedInvites.filter(inv => inv.status === 'cancelled');
  }, [scopedInvites]);

  // Active list filtered and searched dynamically
  const activeFilteredList = useMemo(() => {
    let currentList: ReviewInvite[] = [];
    switch (activeTab) {
      case 'pending':
        currentList = pendingInvites;
        break;
      case 'approved':
        currentList = approvedInvites;
        break;
      case 'invalidated':
        currentList = invalidatedInvites;
        break;
    }

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return currentList.filter(inv => {
        const phone = (inv.guest_phone_masked || '').toLowerCase();
        const token = (inv.token || '').toLowerCase();
        return phone.includes(q) || token.includes(q);
      });
    }

    return currentList;
  }, [activeTab, pendingInvites, approvedInvites, invalidatedInvites, searchQuery]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'emitted':
        return <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded text-[10px] font-semibold font-mono">Emitido</span>;
      case 'opened':
        return <span className="bg-cyan-50 text-cyan-700 border border-cyan-150 px-2.5 py-0.5 rounded text-[10px] font-semibold font-mono animate-pulse">Aberto</span>;
      case 'internal_completed':
        return <span className="bg-emerald-55 text-emerald-800 border border-emerald-100 px-2.5 py-0.5 rounded text-[10px] font-bold font-mono">MyHotel NPS</span>;
      case 'externally_verified_manual':
        return <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded text-[10px] font-bold font-mono">Manual OK</span>;
      case 'externally_reconciled':
        return <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded text-[10px] font-bold font-mono">Integrador OK</span>;
      case 'cancelled':
        return <span className="bg-red-50 text-red-700 border border-red-100 px-2.5 py-0.5 rounded text-[10px] font-semibold font-mono">Invalidado</span>;
      default:
        return <span className="bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded text-[10px] font-mono">{status}</span>;
    }
  };

  const getPlatformDetails = (pId: string) => {
    return platforms.find(p => p.id === pId) || null;
  };

  return (
    <div id="invites-manager-layout" className="space-y-6">
      
      {/* 1. Header explanation without descriptions for extreme mobile minimalism */}
      <div>
        <h2 className="font-sans font-extrabold text-2xl text-slate-800 tracking-wide text-center sm:text-left">
          Emitir Convites de Avaliação
        </h2>
        <p className="text-xs text-slate-500 mt-1 text-center sm:text-left">
          Toque na plataforma desejada para emitir o código de feed único para o hóspede.
        </p>
      </div>

      {/* 2. Grid of Brand Platform Cards
         - Centered layout, identical sizing, no extra text row labels, highly visual and mobile-optimized */}
      <div id="platform-grid-buttons" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
        {platforms.filter(p => p.active).map((plat) => {
          let buttonClass = "";
          let logoSvg: React.ReactNode = null;

          if (plat.code === 'google') {
            buttonClass = "bg-white border-[#4285F4]/30 hover:border-[#4285F4] dark:bg-slate-800 dark:border-slate-700/80 hover:shadow-[0_8px_30px_rgba(66,133,244,0.08)]";
            logoSvg = <GoogleLogoSvg />;
          } else if (plat.code === 'booking') {
            buttonClass = "bg-white border-[#003580]/30 hover:border-[#003580] dark:bg-slate-800 dark:border-slate-700/80 hover:shadow-[0_8px_30px_rgba(0,53,128,0.08)]";
            logoSvg = <BookingLogoSvg />;
          } else if (plat.code === 'tripadvisor') {
            buttonClass = "bg-white border-[#00AA6C]/30 hover:border-[#00AA6C] dark:bg-slate-800 dark:border-slate-700/80 hover:shadow-[0_8px_30px_rgba(0,170,108,0.08)]";
            logoSvg = <TripAdvisorLogoSvg />;
          } else if (plat.code === 'internal') {
            buttonClass = "bg-white border-[#1198db]/30 hover:border-[#1198db] dark:bg-slate-800 dark:border-slate-700/80 hover:shadow-[0_8px_30px_rgba(17,152,219,0.08)]";
            logoSvg = <MyHotelLogoSvg />;
          } else {
            buttonClass = "bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700 hover:border-slate-800 dark:hover:border-slate-500";
            logoSvg = <span className="font-bold text-slate-600 dark:text-slate-300">{plat.name}</span>;
          }

          return (
            <button
              key={plat.id}
              onClick={() => setSelectedPlatformForModal(plat)}
              id={`btn-platform-invite-${plat.code}`}
              className={`h-28 w-full flex items-center justify-center p-6 rounded-[22px] border shadow-sm transition-all duration-200 active:scale-95 group cursor-pointer ${buttonClass}`}
              title={`Emitir convite para ${plat.name}`}
            >
              {logoSvg}
            </button>
          );
        })}
      </div>

      {/* 3. Division Tabs to track dynamic outputs with extreme fidelity */}
      <div id="guardian-recent-history" className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 space-y-6">
        
        {/* Dynamic Division Controls Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-3">
          <div className="flex overflow-x-auto no-scrollbar scroll-smooth">
            <button
              onClick={() => setActiveTab('pending')}
              className={`py-3 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-all flex items-center space-x-2 hover:text-slate-800 cursor-pointer
                ${activeTab === 'pending' 
                  ? 'border-amber-500 text-slate-850 font-bold' 
                  : 'border-transparent text-slate-400'}`}
            >
              <Clock className="h-4 w-4 shrink-0 text-slate-400" />
              <span>Aguardando Aprovação</span>
              <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-full font-bold">
                {pendingInvites.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('approved')}
              className={`py-3 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-all flex items-center space-x-2 hover:text-slate-800 cursor-pointer
                ${activeTab === 'approved' 
                  ? 'border-amber-500 text-slate-850 font-bold' 
                  : 'border-transparent text-slate-400'}`}
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              <span>Aprovados</span>
              <span className="bg-emerald-50 text-emerald-600 text-[10px] px-2 py-0.5 rounded-full font-bold">
                {approvedInvites.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('invalidated')}
              className={`py-3 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-all flex items-center space-x-2 hover:text-slate-800 cursor-pointer
                ${activeTab === 'invalidated' 
                  ? 'border-amber-500 text-slate-850 font-bold' 
                  : 'border-transparent text-slate-400'}`}
            >
              <XCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>Invalidados</span>
              <span className="bg-red-50 text-red-600 text-[10px] px-2 py-0.5 rounded-full font-bold">
                {invalidatedInvites.length}
              </span>
            </button>
          </div>

          {/* Search bar inside Division controls */}
          <div className="relative w-full md:w-64">
            <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 pointer-events-none">
              <Search className="h-3.5 w-3.5" />
            </span>
            <input
              type="text"
              placeholder="Pesquisar hóspede..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 border border-slate-200 rounded-xl text-xs outline-none focus:border-amber-500/55 transition-colors"
            />
          </div>
        </div>

        {/* Responsive Mobile Layout (List Cards) */}
        <div className="block md:hidden space-y-3">
          {activeFilteredList.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs font-light">
              Nenhum convite encontrado nesta aba de divisões.
            </div>
          ) : (
            activeFilteredList.map((row) => {
              const plat = getPlatformDetails(row.platform_id);
              return (
                <div key={row.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-150 dark:border-slate-800 shadow-sm space-y-2.5 text-slate-800 dark:text-slate-100">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <span 
                        className="h-2 w-2 rounded-full" 
                        style={{ backgroundColor: plat?.color || '#94a3b8' }} 
                      />
                      <span className="font-bold text-slate-800 text-xs">{plat?.name || 'Canal Desconhecido'}</span>
                    </div>
                    {getStatusBadge(row.status)}
                  </div>

                  {/* Complete guest information layout */}
                  <div className="text-xs font-sans text-slate-700 dark:text-slate-250 flex flex-col space-y-1.5 py-2 border-t border-b border-slate-50 dark:border-slate-800/60">
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Hóspede</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{row.guest_name || 'Hóspede Identificado'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Apartamento</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 font-mono text-[11px]">{row.room_number || '-'}</span>
                    </div>
                    {row.guest_phone_masked && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">WhatsApp</span>
                        <span className="font-mono text-slate-500 text-right text-[11px]">{row.guest_phone_masked}</span>
                      </div>
                    )}
                  </div>

                  <div className="text-xs font-mono text-slate-500 flex justify-between py-1 text-[11px]">
                    <div>
                      <span className="block text-[9px] text-slate-400">Método</span>
                      <strong>{row.method === 'qr' ? 'QR Code' : row.method === 'whatsapp' ? 'WhatsApp' : 'Assistido'}</strong>
                    </div>
                    <div className="text-right">
                      <span className="block text-[9px] text-slate-400">Cliques / Status</span>
                      <strong>{row.opened_count} cliques</strong>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[10.5px] border-t border-slate-50 dark:border-slate-800/60 pt-2">
                    <span className="text-slate-400 font-mono">
                      {new Date(row.created_at).toLocaleDateString('pt-BR')} às {new Date(row.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    
                    <button
                      onClick={() => startEditingGuest(row)}
                      className="p-1 px-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950 hover:text-amber-700 dark:hover:text-amber-400 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center space-x-1 cursor-pointer"
                      title="Editar hóspede"
                    >
                      <Edit3 className="h-3 w-3" />
                      <span>Alterar</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Layout (Standard Table) */}
        <div className="hidden md:block overflow-x-auto select-none">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Canal / Link</th>
                <th className="py-3 px-4">Método</th>
                <th className="py-3 px-4">Hóspede (Nome e Apto)</th>
                <th className="py-3 px-4">Contato (WhatsApp)</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Aberturas</th>
                <th className="py-3 px-4 text-right">Data de Emissão</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="text-xs text-slate-705 divide-y divide-slate-50 dark:divide-slate-800/50">
              {activeFilteredList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 font-light">
                    Nenhum convite encontrado nesta aba de divisões.
                  </td>
                </tr>
              ) : (
                activeFilteredList.map((row) => {
                  const plat = getPlatformDetails(row.platform_id);
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-805 dark:text-slate-100">
                        <div className="flex items-center space-x-2">
                          <span 
                            className="h-2 w-2 rounded-full" 
                            style={{ backgroundColor: plat?.color || '#94a3b8' }} 
                          />
                          <span>{plat?.name || 'Canal Desconhecido'}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="capitalize font-mono text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350 px-1.5 py-0.5 rounded">
                          {row.method === 'qr' ? 'QR Code' : row.method === 'whatsapp' ? 'WhatsApp' : 'Assistido'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 dark:text-slate-100">
                            {row.guest_name || 'Hóspede Identificado'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase">
                            Apto: <strong className="font-mono text-[11px] text-slate-650 dark:text-slate-300 font-bold">{row.room_number || '-'}</strong>
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[10px] text-slate-550 dark:text-slate-400">
                        {row.guest_phone_masked || '-'}
                      </td>
                      <td className="py-3.5 px-4">
                        {getStatusBadge(row.status)}
                      </td>
                      <td className="py-3.5 px-4 font-bold font-mono text-slate-700 dark:text-slate-300">
                        {row.opened_count}x
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-400 font-mono text-[11px]">
                        {new Date(row.created_at).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => startEditingGuest(row)}
                          className="p-1 px-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-955 hover:text-amber-700 dark:hover:text-amber-400 border border-slate-150 dark:border-slate-700 rounded-lg text-[11px] font-semibold text-slate-650 dark:text-slate-300 inline-flex items-center space-x-1 cursor-pointer transition-all active:scale-95"
                          title="Atualizar Nome e Apartamento"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Alterar</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Guest Details Editing Modal */}
      {editingGuestInvite && (
        <div id="edit-guest-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in animate-none">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[24px] shadow-xl border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden">
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <Edit3 className="h-4.5 w-4.5 text-amber-500" />
                <h3 className="font-sans font-bold text-base text-slate-800 dark:text-white">
                  Dados do Hóspede
                </h3>
              </div>
              <button 
                onClick={() => setEditingGuestInvite(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <XCircle className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveGuestEdit} className="p-6 space-y-4">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Atualize o nome e o quarto/apartamento associado ao QR Code ou link de WhatsApp emitido.
              </p>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-slate-450 uppercase">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={editGuestName}
                    onChange={(e) => setEditGuestName(e.target.value)}
                    placeholder="Ex: Carlos Oliveira"
                    className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-xl outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-slate-450 uppercase">
                    Apartamento / Quarto *
                  </label>
                  <input
                    type="text"
                    required
                    value={editRoomNumber}
                    onChange={(e) => setEditRoomNumber(e.target.value)}
                    placeholder="Ex: 304"
                    className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-xl outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 flex items-center space-x-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingGuestInvite(null)}
                  className="flex-1 h-9 border border-slate-205 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer"
                  disabled={isSavingEdit}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="flex-1 h-9 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold flex items-center justify-center transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {isSavingEdit ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal handler */}
      {selectedPlatformForModal && (
        <QRGeneratorModal
          platform={selectedPlatformForModal}
          onClose={() => setSelectedPlatformForModal(null)}
          onInviteCreated={onInviteCreated}
        />
      )}

    </div>
  );
}
