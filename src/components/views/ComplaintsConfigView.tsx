import React, { useState, useEffect } from 'react';
import { 
  AlertCircle, Clock, CheckCircle2, Search, MessageSquare, 
  Check, Play, ArrowRight, CornerDownRight, Filter, AlertTriangle, RefreshCw
} from 'lucide-react';
import { Complaint, ComplaintStatus, Profile } from '../../types';
import { ApiService } from '../../lib/api';

interface ComplaintsConfigViewProps {
  user: Profile | null;
}

export default function ComplaintsConfigView({ user }: ComplaintsConfigViewProps) {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // States for resolution modal
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    async function loadComplaints() {
      setLoading(true);
      try {
        const data = await ApiService.getComplaints();
        setComplaints(data);
      } catch (err) {
        console.error('Erro ao buscar do banco reclamações:', err);
      } finally {
        setLoading(false);
      }
    }
    loadComplaints();
  }, [refreshTrigger]);

  const handleStatusChange = async (id: string, newStatus: ComplaintStatus, notes?: string) => {
    try {
      await ApiService.updateComplaintStatus(id, newStatus, notes);
      setRefreshTrigger(prev => prev + 1);
      setSelectedComplaint(null);
      setResolutionNotes('');
    } catch (err) {
      console.error('Erro ao atualizar status da queixa:', err);
      alert('Não foi possível atualizar o status da queixa. Tente novamente.');
    }
  };

  const openResolutionDialog = (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    setResolutionNotes(complaint.resolution_notes || '');
    setIsResolving(true);
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;
    await handleStatusChange(selectedComplaint.id, 'resolved', resolutionNotes);
    setIsResolving(false);
  };

  // Filter complaints
  const filteredComplaints = complaints.filter(c => {
    const matchesSearch = 
      c.guest_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.room_number.includes(searchTerm) ||
      c.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (statusFilter === 'all') return matchesSearch;
    return c.status === statusFilter && matchesSearch;
  });

  const getStatusBadge = (status: ComplaintStatus) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-red-700 bg-red-100 rounded-lg dark:bg-red-500/10 dark:text-red-400">
            <AlertCircle className="w-3.5 h-3.5" />
            Pendente
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-amber-700 bg-amber-100 rounded-lg dark:bg-amber-500/10 dark:text-amber-400 font-sans">
            <Clock className="w-3.5 h-3.5" />
            Em Andamento
          </span>
        );
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-100 rounded-lg dark:bg-emerald-500/10 dark:text-emerald-400 font-sans">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Resolvido
          </span>
        );
      default:
        return null;
    }
  };

  // Metrics counts
  const pendingCount = complaints.filter(c => c.status === 'pending').length;
  const inProgressCount = complaints.filter(c => c.status === 'in_progress').length;
  const resolvedCount = complaints.filter(c => c.status === 'resolved').length;

  return (
    <div id="complaints-view-container" className="space-y-6">
      {/* Title section with description */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="font-sans font-bold text-2xl text-slate-800 dark:text-white flex items-center gap-3">
            <AlertTriangle className="h-7 w-7 text-amber-500" />
            Ocorrências & Reclamações
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Controle interno de reclamações recebidas silenciosamente durante os atendimentos. Resolva pendências para reter hóspedes satisfeitos.
          </p>
        </div>
        <button 
          id="btn-refresh-complaints"
          onClick={() => setRefreshTrigger(p => p + 1)}
          className="flex items-center justify-center gap-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 p-2.5 rounded-lg text-slate-600 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Sincronizar
        </button>
      </div>

      {/* Metrics bento-grid cells */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Pending Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase">Casos Pendentes</span>
            <p className="font-sans font-extrabold text-3xl text-red-600 dark:text-red-500 font-mono">{loading ? '...' : pendingCount}</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-red-100 dark:bg-red-500/10 flex items-center justify-center text-red-600 dark:text-red-400">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>

        {/* In Progress Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase">Em Resolução</span>
            <p className="font-sans font-extrabold text-3xl text-amber-600 dark:text-amber-500 font-mono">{loading ? '...' : inProgressCount}</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Resolved Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase">Ocorrências Resolvidas</span>
            <p className="font-sans font-extrabold text-3xl text-emerald-600 dark:text-emerald-500 font-mono">{loading ? '...' : resolvedCount}</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Query filters row */}
      <div className="bg-white dark:bg-slate-900 p-4 border border-slate-150 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="h-4 w-4" />
          </span>
          <input
            id="search-complaints-input"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por hóspede, apto ou conteúdo da queixa..."
            className="w-full text-xs pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-amber-500 dark:text-white"
          />
        </div>

        {/* Status Tab buttons */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200/60 dark:border-slate-800 w-full md:w-auto overflow-x-auto no-scrollbar">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${statusFilter === 'all' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
          >
            Todos ({complaints.length})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${statusFilter === 'pending' ? 'bg-red-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
          >
            Pendentes ({pendingCount})
          </button>
          <button
            onClick={() => setStatusFilter('in_progress')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${statusFilter === 'in_progress' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
          >
            Andamento ({inProgressCount})
          </button>
          <button
            onClick={() => setStatusFilter('resolved')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${statusFilter === 'resolved' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
          >
            Resolvido ({resolvedCount})
          </button>
        </div>
      </div>

      {/* Main List container */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl">
            <RefreshCw className="h-7 w-7 text-amber-500 animate-spin mx-auto mb-2" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Carregando livro de ocorrências...</p>
          </div>
        ) : filteredComplaints.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl">
            <MessageSquare className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto mb-2.5" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nenhuma queixa encontrada</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Parabéns! Nenhuma ocorrência ou queixa pendente de atenção.</p>
          </div>
        ) : (
          filteredComplaints.map(item => (
            <div 
              key={item.id}
              className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm transition-all relative flex flex-col md:flex-row md:items-start justify-between gap-4
                ${item.status === 'pending' ? 'border-red-150 dark:border-red-900/20' : ''}
                ${item.status === 'in_progress' ? 'border-amber-150 dark:border-amber-900/20' : ''}
                ${item.status === 'resolved' ? 'border-slate-150 dark:border-slate-800' : ''}
              `}
            >
              {/* Primary content info section */}
              <div className="space-y-3.5 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-150 dark:border-slate-75 font-mono text-xs dark:text-slate-300 font-bold">
                    Apt {item.room_number}
                  </div>
                  <h4 className="font-sans font-bold text-sm text-slate-800 dark:text-white truncate">
                    {item.guest_name}
                  </h4>
                  <div className="ml-auto sm:ml-0 md:ml-2">
                    {getStatusBadge(item.status)}
                  </div>
                </div>

                {/* Complaint text body */}
                <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 leading-relaxed font-sans">
                  <p className="whitespace-pre-line">{item.description}</p>
                </div>

                <div className="flex items-center gap-4 text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                  <span>Registrado em: {new Date(item.created_at).toLocaleString('pt-BR')}</span>
                  {item.updated_at !== item.created_at && (
                    <span>• Último andamento: {new Date(item.updated_at).toLocaleString('pt-BR')}</span>
                  )}
                </div>

                {/* Internal Resolution Display */}
                {item.status === 'resolved' && (
                  <div className="mt-2 bg-emerald-500/5 dark:bg-emerald-500/5 border border-emerald-500/25 dark:border-emerald-500/10 p-3.5 rounded-xl text-xs space-y-1 animate-none">
                    <p className="font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-1 text-[11px] uppercase tracking-wide">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Ocorrência Resolvida
                    </p>
                    {item.resolution_notes && (
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed font-sans text-xs mt-1 bg-white/40 dark:bg-slate-950/40 p-2 border border-emerald-500/10 rounded-lg">
                        {item.resolution_notes}
                      </p>
                    )}
                    <span className="block text-[10px] text-emerald-600 dark:text-emerald-500 font-mono pt-1 text-right">
                      Solucionado por: {item.resolver_name || 'Equipe de Atendimento'}
                    </span>
                  </div>
                )}
              </div>

              {/* Action column buttons */}
              {item.status !== 'resolved' && (
                <div className="flex sm:flex-row md:flex-col items-center gap-2 shrink-0 self-end md:self-center">
                  {item.status === 'pending' && (
                    <button
                      onClick={() => handleStatusChange(item.id, 'in_progress')}
                      className="w-full flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 dark:text-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Play className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      Verificar / Atender
                    </button>
                  )}
                  <button
                    onClick={() => openResolutionDialog(item)}
                    className="w-full flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Arquivar Resolvido
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* RESOLUTION MODAL FORM */}
      {isResolving && selectedComplaint && (
        <div id="resolution-modal-overlay" className="fixed inset-0 bg-slate-950/65 flex items-center justify-center p-4 z-55 overflow-y-auto backdrop-blur-sm">
          <div 
            id="resolution-dialog-box"
            className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-none"
          >
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase font-mono">Resolução d'O ocorrência</span>
                <h3 className="font-sans font-bold text-base text-slate-800 dark:text-white">
                  Resolver Ocorrência - Apt {selectedComplaint.room_number}
                </h3>
              </div>
              <button 
                onClick={() => setIsResolving(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 bg-slate-200/50 dark:bg-slate-800 rounded-lg transition-colors"
              >
                <XButton className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleResolveSubmit} className="p-5 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-950 p-3.5 border border-slate-100 dark:border-slate-800 rounded-xl space-y-2">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase font-mono">Relato Original ({selectedComplaint.guest_name})</p>
                <p className="text-xs text-slate-600 dark:text-slate-300 italic">
                  "{selectedComplaint.description}"
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Medida adotada / Notas de Resolução
                </label>
                <textarea
                  required
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Ex: Contatado equipe de manutenção. O ar condicionado foi higienizado e a hélice reparada. O hóspede confirmou funcionamento silencioso."
                  rows={4}
                  className="w-full text-xs p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-amber-500 rounded-xl outline-none resize-none dark:text-white"
                />
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 justify-end pt-2 border-t border-slate-100 dark:border-slate-800 mt-2">
                <button
                  type="button"
                  onClick={() => setIsResolving(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  Salvar Resolução & Arquivar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Compact helper inline X icon to avoid clutter imports
function XButton({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
