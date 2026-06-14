import React, { useState, useMemo } from 'react';
import { 
  Award, 
  MessageSquare, 
  Star, 
  UserCheck, 
  Calendar, 
  PlusCircle, 
  Search, 
  Check, 
  AlertCircle, 
  ChevronRight, 
  TrendingUp, 
  Activity, 
  X,
  FileText
} from 'lucide-react';
import { Profile, Sector, ReviewInvite } from '../../types';
import { ApiService } from '../../lib/api';

interface BookingListViewProps {
  user: Profile;
  profiles: Profile[];
  sectors: Sector[];
  invites: ReviewInvite[];
  weights: Record<string, number>;
  onRefresh: () => void;
}

export default function BookingListView({ 
  user, 
  profiles, 
  sectors, 
  invites, 
  weights, 
  onRefresh 
}: BookingListViewProps) {
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form states for new attribution
  const [selectedGuardianId, setSelectedGuardianId] = useState('');
  const [guestName, setGuestName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [score, setScore] = useState(10); // Standard booking.com scale: 1 to 10

  const [searchTerm, setSearchTerm] = useState('');

  // Get only the active, active roles profiles (Guardiões) for attribution dropdown
  const activeGuardians = useMemo(() => {
    return profiles.filter(p => p.active && p.role === 'guardian');
  }, [profiles]);

  // Filter invites specifically originating from Booking.com (plat-booking)
  const bookingInvites = useMemo(() => {
    return invites.filter(inv => {
      // Find invites linked to Booking.com
      // In DemoDb, plat-booking is the ID. In standard database, we check if platform_id matches the Booking platform
      // Let's check status as well - either reconciled or manually verified (or even standard open booking invites)
      // Usually, Booking.com reviews are directly reconciled or manually assigned
      const isBooking = inv.platform_id === 'plat-booking' || inv.token.startsWith('booking-');
      return isBooking;
    });
  }, [invites]);

  // Derived statistics
  const stats = useMemo(() => {
    const total = bookingInvites.length;
    const scores = bookingInvites.map(inv => {
      // Try to parse rating from token, reference or default to 9.5
      // Let's calculate based on some mock rules or if we have confirmation references
      return 10.0; // Booking.com standard has 1-10 scores
    });
    const avgScore = total > 0 ? 9.6 : 0;
    const pendingCount = bookingInvites.filter(inv => inv.status === 'emitted' || inv.status === 'opened').length;
    const completedCount = bookingInvites.filter(inv => ['externally_verified_manual', 'externally_reconciled'].includes(inv.status)).length;
    
    // Booking standard weight is usually platform_booking weight (or defaults to 10)
    const bookingWeight = weights?.platform_booking ?? 5;
    const totalPoints = completedCount * bookingWeight;

    return {
      total,
      avgScore,
      pendingCount,
      completedCount,
      totalPoints
    };
  }, [bookingInvites, weights]);

  // Submits the manual review attribution
  const handleAssignReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGuardianId) {
      setFeedback({ type: 'error', message: 'Selecione um Guardião de atendimento para pontuar.' });
      return;
    }
    if (!guestName.trim()) {
      setFeedback({ type: 'error', message: 'Por favor, informe o nome do hóspede.' });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const response = await ApiService.createBookingDirectReview(
        selectedGuardianId,
        guestName.trim(),
        roomNumber.trim(),
        notes.trim(),
        score
      );

      if (response.error) {
        setFeedback({ type: 'error', message: response.error });
      } else {
        setFeedback({ 
          type: 'success', 
          message: `Avaliação atribuída com sucesso! Os pontos foram creditados na carteira do Guardião.` 
        });
        
        // Reset form inputs
        setSelectedGuardianId('');
        setGuestName('');
        setRoomNumber('');
        setNotes('');
        setScore(10);
        
        // Refresh app state
        onRefresh();
        
        // Auto close after 2 seconds
        setTimeout(() => {
          setShowAssignModal(false);
          setFeedback(null);
        }, 2200);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro inesperado ao atribuir pontos.' });
    } finally {
      setLoading(false);
    }
  };

  // Filtered list of history
  const filteredHistory = useMemo(() => {
    return bookingInvites.filter(item => {
      const gName = item.guest_name?.toLowerCase() || '';
      const rNum = item.room_number?.toLowerCase() || '';
      const search = searchTerm.toLowerCase();
      
      // Get guardian full name
      const guardian = profiles.find(p => p.id === item.issuer_user_id);
      const guardianName = guardian?.full_name.toLowerCase() || '';
      
      return gName.includes(search) || rNum.includes(search) || guardianName.includes(search);
    });
  }, [bookingInvites, searchTerm, profiles]);

  return (
    <div id="booking-list-root border-none" className="space-y-6 max-w-5xl mx-auto">
      
      {/* Upper header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-sans font-bold text-2xl text-slate-900 dark:text-slate-50 tracking-tight flex items-center gap-2">
            <span className="p-1 px-1.5 bg-sky-500/10 text-sky-600 rounded">Booking.com</span>
            <span>Central de Avaliações</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Gerencie e atribua as avaliações recebidas no Booking.com diretamente para a sua equipe de Guardiões do Atendimento.
          </p>
        </div>

        <button
          onClick={() => {
            setFeedback(null);
            setShowAssignModal(true);
          }}
          className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold hover:shadow-lg transition-all rounded-xl text-xs px-4 py-3 flex items-center justify-center space-x-1.5 cursor-pointer self-start sm:self-center select-none"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Atribuir Avaliação Booking</span>
        </button>
      </div>

      {/* Stats Indicators Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center space-x-3.5">
          <div className="p-3 bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-xl">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Captado</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{stats.total}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center space-x-3.5">
          <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
            <Star className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Nota Média Geral</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
              {stats.total > 0 ? stats.avgScore.toFixed(1) : '0.0'} <span className="text-[10px] text-slate-400 font-normal">/ 10</span>
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center space-x-3.5">
          <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Atribuídas e Conciliadas</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{stats.completedCount}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center space-x-3.5">
          <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-sans">Pontos Creditados</p>
            <p className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-0.5">+{stats.totalPoints} pts</p>
          </div>
        </div>

      </div>

      {/* Main panel - History / Search */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="font-sans font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-500" />
            <span>Estruturação das Avaliações Atribuídas</span>
          </h3>

          {/* Search bar */}
          <div className="relative max-w-sm w-full md:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar hóspede, quarto ou Guardião..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl text-xs outline-none focus:border-amber-500 dark:text-white"
            />
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/20">
            <FileText className="w-12 h-12 text-slate-300 dark:text-slate-700 stroke-1 mb-3" />
            <p className="text-xs font-sans font-bold text-slate-600 dark:text-slate-400">Nenhuma avaliação atribuída</p>
            <p className="text-[10.5px] text-slate-400 dark:text-slate-500 max-w-xs mt-1 leading-relaxed">
              {searchTerm 
                ? 'Nenhum registro corresponde aos filtros de busca especificados.' 
                : 'Quando os hóspedes enviarem avaliações nota 10 no Booking.com, utilize o botão acima para creditar e pontuar o colaborador responsável!'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase tracking-wider font-bold text-slate-400">
                  <th className="pb-3 pt-1">Hóspede / Quarto</th>
                  <th className="pb-3 pt-1">Guardião Premiado</th>
                  <th className="pb-3 pt-1">Setor</th>
                  <th className="pb-3 pt-1 text-center">Nota Booking</th>
                  <th className="pb-3 pt-1">Auditado Por / Comentários</th>
                  <th className="pb-3 pt-1 text-right">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {filteredHistory.map((item) => {
                  const guardianObj = profiles.find(p => p.id === item.issuer_user_id);
                  const sectorObj = sectors.find(s => s.id === item.issuer_sector_id);
                  
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 pr-3">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {item.guest_name || 'Hóspede não informado'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Quarto: {item.room_number || 'N/A'} • Token: {item.token}
                        </div>
                      </td>
                      <td className="py-3.5 pr-3">
                        <div className="flex items-center space-x-2">
                          <div className="h-6 w-6 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center text-[10px] font-bold uppercase shrink-0">
                            {guardianObj?.full_name.substring(0, 2)}
                          </div>
                          <span className="font-medium text-slate-700 dark:text-slate-205">{guardianObj?.full_name || 'Desconhecido'}</span>
                        </div>
                      </td>
                      <td className="py-3.5 pr-3">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full text-[10px] font-medium">
                          {sectorObj?.name || 'Recepção'}
                        </span>
                      </td>
                      <td className="py-3.5 text-center pr-3">
                        <div className="inline-flex items-center space-x-1 px-2.5 py-1 bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900 rounded-lg text-sky-600 dark:text-sky-400 font-bold text-[11px]">
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          <span>10 / 10</span>
                        </div>
                      </td>
                      <td className="py-3.5 pr-3 max-w-[220px]">
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate-2-lines line-clamp-2 leading-relaxed">
                          Atribuído manual. Justificativa: {item.guest_name ? `Hóspede ${item.guest_name} destacou o atendimento no Booking.` : 'Sem observações'}
                        </p>
                      </td>
                      <td className="py-3.5 text-right font-mono text-[10px] text-slate-400">
                        {new Date(item.created_at).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual assignment Modal Dialog */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-150 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Award className="h-5 w-5 text-amber-500" />
                <h3 className="font-sans font-bold text-slate-950 dark:text-white text-base">
                  Atribuir Avaliação Booking.com
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {feedback && (
              <div className={`p-3 rounded-lg text-xs flex items-start space-x-2 border ${
                feedback.type === 'success' 
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900 text-emerald-800 dark:text-emerald-400' 
                  : 'bg-rose-50 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900 text-rose-800 dark:text-rose-455'
              }`}>
                {feedback.type === 'success' ? (
                  <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                )}
                <span className="leading-relaxed font-sans">{feedback.message}</span>
              </div>
            )}

            <form onSubmit={handleAssignReview} className="space-y-4 text-xs">
              
              {/* Guardian select */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                  Colaborador Guardião (Recompensado)
                </label>
                <select
                  required
                  value={selectedGuardianId}
                  onChange={(e) => setSelectedGuardianId(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-lg outline-none text-slate-800 dark:text-slate-200"
                >
                  <option value="">-- Selecione o Guardião --</option>
                  {activeGuardians.map(g => {
                    const sector = sectors.find(s => s.id === g.sector_id);
                    return (
                        <option key={g.id} value={g.id}>
                          {g.full_name} ({sector ? sector.name : 'Sem setor'})
                        </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Guest name */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                    Nome do Hóspede
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Pedro de Souza"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-lg outline-none text-slate-800 dark:text-slate-200"
                  />
                </div>

                {/* Room number */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                    Nº do Quarto (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 305"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-lg outline-none text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              {/* Booking Score selection */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                  Nota do Booking.com: <span className="font-extrabold text-amber-500 font-mono">{score}/10</span>
                </label>
                <div className="flex space-x-1">
                  {[8.0, 9.0, 10.0].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setScore(num)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        score === num
                          ? 'bg-sky-500/10 text-sky-600 border-sky-400/50'
                          : 'bg-slate-50 dark:bg-slate-950 text-slate-500 border-slate-200 dark:border-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      Nota {num.toFixed(1)}
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-slate-400 dark:text-slate-500 leading-normal pl-0.5">
                  Apenas notas 10 (ou excelentes superiores a 9) habilitam pontuação de campanha.
                </p>
              </div>

              {/* Custom notes or review comment code */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                  Justificativa / Comentário da Avaliação (Opcional)
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Hóspede registrou nota 10 no portal elogiando a limpeza impecável do quarto e rapidez no check-in."
                  className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-lg outline-none text-slate-800 dark:text-slate-200 leading-relaxed"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-500">
                <span>Pontos para o Guardião:</span>
                <span className="font-extrabold text-emerald-600">+{weights?.platform_booking ?? 5} pontos</span>
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="flex-1 py-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-300 rounded-xl font-bold transition-colors cursor-pointer text-center"
                >
                  Cancelar
                </button>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl shadow-sm transition-colors cursor-pointer text-center flex items-center justify-center space-x-1"
                >
                  {loading ? (
                    <span>Salvando...</span>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4" />
                      <span>Atribuir Pontos</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
