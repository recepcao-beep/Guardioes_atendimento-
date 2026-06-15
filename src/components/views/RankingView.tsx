import React, { useState, useMemo } from 'react';
import { 
  Trophy, Award, Crown, Calendar, Sparkles, Filter, Info,
  TrendingUp, CheckCircle, ArrowDownCircle, UsersRound
} from 'lucide-react';
import { Sector, Profile, ReviewInvite, Platform } from '../../types';
import { calculateInvitePoints } from '../../lib/api';

interface RankingViewProps {
  user: Profile;
  sectors: Sector[];
  profiles: Profile[];
  platforms: Platform[];
  invites: ReviewInvite[];
  weights: Record<string, number>;
}

export default function RankingView({
  user, sectors, profiles, platforms, invites, weights
}: RankingViewProps) {
  
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  });

  const [selectedSector, setSelectedSector] = useState<string>('all');

  // List of last 6 months for filtering
  const monthsList = useMemo(() => {
    const list = [];
    const d = new Date();
    for (let i = 0; i < 6; i++) {
      const past = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const val = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}`;
      const name = past.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      list.push({ val, name: name.charAt(0).toUpperCase() + name.slice(1) });
    }
    return list;
  }, []);

  // --- LEADERBOARD COMPILING PIPELINE ---
  const leaderboard = useMemo(() => {
    // Collect active invites for the selected month YYYY-MM
    const monthlyInvites = invites.filter(i => {
      const parts = i.created_at.split('T')[0].split('-');
      const monthKey = `${parts[0]}-${parts[1]}`;
      return monthKey === selectedMonth;
    });

    const platformById = new Map(platforms.map(platform => [platform.id, platform]));

    // 1. Compile individual scores
    const indScores: Record<string, {
      profile: Profile;
      points: number;
      emittedCount: number;
      openedCount: number;
      conversionsCount: number;
    }> = {};

    profiles.forEach(p => {
      indScores[p.id] = {
        profile: p,
        points: 0,
        emittedCount: 0,
        openedCount: 0,
        conversionsCount: 0
      };
    });

    monthlyInvites.forEach(inv => {
      const em = inv.issuer_user_id;
      if (!indScores[em]) return;

      indScores[em].emittedCount += 1;
      if (inv.opened_count > 0) {
        indScores[em].openedCount += 1;
      }

      if (['internal_completed', 'externally_verified_manual', 'externally_reconciled'].includes(inv.status)) {
        indScores[em].conversionsCount += 1;
        indScores[em].points += calculateInvitePoints(inv.status, weights, platformById.get(inv.platform_id) || inv.platform_id);
      }
    });

    // Convert map to sorted array & filter based on sector if requested
    let filteredIndividuals = Object.values(indScores)
      .filter(x => x.profile.active);

    if (selectedSector !== 'all') {
      filteredIndividuals = filteredIndividuals.filter(x => x.profile.sector_id === selectedSector);
    }

    const sortedIndividuals = filteredIndividuals.sort((a, b) => 
      b.points - a.points || 
      b.conversionsCount - a.conversionsCount || 
      b.emittedCount - a.emittedCount
    );

    // 2. Compile Sector scores
    const secScores: Record<string, {
      sector: Sector;
      points: number;
      emittedCount: number;
      conversionsCount: number;
      membersCount: number;
    }> = {};

    sectors.forEach(s => {
      const sectorMembers = profiles.filter(p => p.sector_id === s.id && p.active).length;
      secScores[s.id] = {
        sector: s,
        points: 0,
        emittedCount: 0,
        conversionsCount: 0,
        membersCount: sectorMembers
      };
    });

    monthlyInvites.forEach(inv => {
      const sId = inv.issuer_sector_id;
      if (!sId || !secScores[sId]) return;

      secScores[sId].emittedCount += 1;
      if (['internal_completed', 'externally_verified_manual', 'externally_reconciled'].includes(inv.status)) {
        secScores[sId].conversionsCount += 1;
        secScores[sId].points += calculateInvitePoints(inv.status, weights, platformById.get(inv.platform_id) || inv.platform_id);
      }
    });

    const sortedSectors = Object.values(secScores)
      .filter(x => x.sector.active)
      .sort((a, b) => b.points - a.points || b.conversionsCount - a.conversionsCount);

    return {
      individuals: sortedIndividuals,
      sectors: sortedSectors,
      topThree: sortedIndividuals.slice(0, 3)
    };
  }, [invites, profiles, sectors, platforms, selectedMonth, selectedSector, weights]);

  // Helpers
  const getSectorName = (id: string | null) => {
    if (!id) return '-';
    return sectors.find(s => s.id === id)?.name || 'Sem Setor';
  };

  const selectedMonthName = useMemo(() => {
    return monthsList.find(m => m.val === selectedMonth)?.name || selectedMonth;
  }, [selectedMonth, monthsList]);

  return (
    <div id="leaderboard-page-layout" className="space-y-6">
      
      {/* Upper header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-sans font-extrabold text-2xl text-slate-800 tracking-wide">
            Classificações e Desempenho
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Resultados consolidados e rankings de guardiões referenciados à pontuação mensal.
          </p>
        </div>

        {/* Month selector action dropdown */}
        <div className="flex items-center space-x-2 shrink-0">
          <Calendar className="h-4 w-4 text-slate-400" />
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-xs border border-slate-200 bg-white font-medium text-slate-700 outline-none p-2 rounded-lg"
          >
            {monthsList.map(m => (
              <option key={m.val} value={m.val}>{m.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* TOP THREE PODIUM (FOR INDIVIDUALS) */}
      {leaderboard.topThree.length > 0 && selectedSector === 'all' && (
        <div id="podium-section" className="bg-gradient-to-tr from-slate-900 via-slate-900 to-slate-800 p-6 rounded-2xl border border-slate-800 text-white shadow-lg space-y-6 animate-fade-in relative overflow-hidden">
          <div className="absolute top-0 right-0 opacity-10 pointer-events-none">
            <Crown className="w-48 h-48 text-amber-500 -mr-6 -mt-6" />
          </div>
          
          <div className="text-center md:text-left">
            <span className="text-[10px] bg-amber-500/10 text-amber-400 font-mono font-bold tracking-widest px-3 py-1 rounded-full border border-amber-500/25 uppercase">
              Podium de Campeões
            </span>
            <h3 className="font-sans font-black text-lg md:text-xl text-amber-50 mt-3 tracking-wide">
              Líderes de Hospitalidade — {selectedMonthName}
            </h3>
            <p className="text-xs text-slate-450 text-slate-400 mt-1 leading-relaxed max-w-xl">
              Nossos guardiões que mais acolheram hóspedes e coletaram as melhores recomendações oficiais neste ciclo.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            
            {/* 2nd spot */}
            {leaderboard.topThree[1] && (
              <div className="bg-slate-800 border border-slate-800/80 p-5 rounded-xl text-center flex flex-col items-center justify-between relative order-2 md:order-1">
                <div className="absolute top-3 left-3 bg-slate-700 text-slate-100 h-6 w-6 rounded-full font-bold flex items-center justify-center font-mono text-xs">
                  2
                </div>
                
                <div className="h-12 w-12 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-800 dark:text-slate-200 font-bold text-lg font-sans border border-slate-700">
                  {leaderboard.topThree[1].profile.avatar_url ? (
                    <img src={leaderboard.topThree[1].profile.avatar_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt="" />
                  ) : (
                    leaderboard.topThree[1].profile.full_name.charAt(0).toUpperCase()
                  )}
                </div>
                
                <div className="mt-3">
                  <h4 className="font-semibold text-sm text-slate-100 truncate max-w-[180px]">
                    {leaderboard.topThree[1].profile.full_name}
                  </h4>
                  <p className="text-[11px] text-slate-450 text-slate-400 mt-0.5">
                    {getSectorName(leaderboard.topThree[1].profile.sector_id)}
                    {leaderboard.topThree[1].profile.role === 'admin' && ' (Admin)'}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 w-full flex items-center justify-between text-xs">
                  <span className="text-slate-400 text-[11px] font-mono">{leaderboard.topThree[1].conversionsCount} conversões</span>
                  <span className="font-bold text-amber-400 font-mono text-sm">{leaderboard.topThree[1].points} pts</span>
                </div>
              </div>
            )}

            {/* 1st spot - CHAMPION */}
            {leaderboard.topThree[0] && (
              <div className="bg-slate-800 border-2 border-amber-500/40 p-6 rounded-xl text-center flex flex-col items-center justify-between relative order-1 md:order-2 scale-[1.03] shadow-md shadow-amber-500/5">
                <div className="absolute top-3 right-3">
                  <Crown className="h-6 w-6 text-amber-400 animate-bounce" />
                </div>
                <div className="absolute top-3 left-3 bg-amber-500 text-slate-950 h-6 w-6 rounded-full font-sans font-bold flex items-center justify-center text-xs">
                  1
                </div>

                <div className="h-14 w-14 rounded-full overflow-hidden bg-amber-500 hover:bg-amber-400 transition-colors text-slate-950 font-bold text-xl font-sans flex items-center justify-center shadow-lg relative border-2 border-amber-300">
                  <span className="absolute -top-1.5 px-2 bg-slate-950 text-amber-400 rounded-full text-[9px] font-mono uppercase font-bold tracking-widest border border-amber-500/20">Líder</span>
                  {leaderboard.topThree[0].profile.avatar_url ? (
                    <img src={leaderboard.topThree[0].profile.avatar_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt="" />
                  ) : (
                    leaderboard.topThree[0].profile.full_name.charAt(0).toUpperCase()
                  )}
                </div>

                <div className="mt-3.5">
                  <h4 className="font-sans font-extrabold text-base text-slate-100 truncate max-w-[200px]">
                    {leaderboard.topThree[0].profile.full_name}
                  </h4>
                  <p className="text-xs text-amber-400 mt-1 font-mono">
                    {getSectorName(leaderboard.topThree[0].profile.sector_id)}
                    {leaderboard.topThree[0].profile.role === 'admin' && ' (Admin)'}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-700/80 w-full flex items-center justify-between text-xs">
                  <span className="text-slate-350 text-[11px] text-slate-300 font-mono">{leaderboard.topThree[0].conversionsCount} conversões</span>
                  <span className="font-extrabold text-amber-300 font-mono text-base">{leaderboard.topThree[0].points} pts</span>
                </div>
              </div>
            )}

            {/* 3rd spot */}
            {leaderboard.topThree[2] && (
              <div className="bg-slate-800 border border-slate-800/80 p-5 rounded-xl text-center flex flex-col items-center justify-between relative order-3">
                <div className="absolute top-3 left-3 bg-amber-800/20 text-amber-600 border border-amber-800/30 h-6 w-6 rounded-full font-bold flex items-center justify-center font-mono text-xs">
                  3
                </div>

                <div className="h-12 w-12 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-800 dark:text-slate-200 font-bold text-lg font-sans border border-slate-700">
                  {leaderboard.topThree[2].profile.avatar_url ? (
                    <img src={leaderboard.topThree[2].profile.avatar_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt="" />
                  ) : (
                    leaderboard.topThree[2].profile.full_name.charAt(0).toUpperCase()
                  )}
                </div>

                <div className="mt-3">
                  <h4 className="font-semibold text-sm text-slate-100 truncate max-w-[180px]">
                    {leaderboard.topThree[2].profile.full_name}
                  </h4>
                  <p className="text-[11px] text-slate-450 text-slate-400 mt-0.5">
                    {getSectorName(leaderboard.topThree[2].profile.sector_id)}
                    {leaderboard.topThree[2].profile.role === 'admin' && ' (Admin)'}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 w-full flex items-center justify-between text-xs">
                  <span className="text-slate-400 text-[11px] font-mono">{leaderboard.topThree[2].conversionsCount} conversões</span>
                  <span className="font-bold text-amber-500 font-mono text-sm">{leaderboard.topThree[2].points} pts</span>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* FILTER BAR FOR RATING SECTOR IN TABLES */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <Filter className="h-4.5 w-4.5 text-slate-500" />
          <span className="text-xs font-bold uppercase text-slate-700 tracking-wider">Filtrar Rankings</span>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <label className="text-slate-550 font-bold text-slate-500">Filtrar por Setor:</label>
          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="border border-slate-200 outline-none p-1.5 rounded-lg text-xs"
          >
            <option value="all">Ver Todos os Setores</option>
            {sectors.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* DOUBLE COMPILATION RANKINGS TABLES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Guardiões Leaderboard - Taking 2/3 column */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm lg:col-span-2 space-y-4">
          <div>
            <h3 className="font-sans font-bold text-base text-slate-800">Classificação Geral de Guardiões</h3>
            <p className="text-xs text-slate-400 mt-0.5">Pontuação acumulada de conversões válidas no ciclo atual</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Rank</th>
                  <th className="py-2.5 px-3">Colaborador (Guardião)</th>
                  <th className="py-2.5 px-3">Setor</th>
                  <th className="py-2.5 px-4 text-center">Emitidos</th>
                  <th className="py-2.5 px-4 text-center">Convertidos</th>
                  <th className="py-2.5 px-4 text-center">Conversão</th>
                  <th className="py-2.5 px-6 text-right">Mês total</th>
                </tr>
              </thead>
              <tbody className="text-xs text-slate-700 divide-y divide-slate-50">
                {leaderboard.individuals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-light">
                      Nenhum registro para este período ou setor selecionado.
                    </td>
                  </tr>
                ) : (
                  leaderboard.individuals.map((row, index) => {
                    const isLoggedUser = row.profile.id === user.id;
                    const cRate = row.emittedCount > 0 ? Math.round((row.conversionsCount / row.emittedCount)*100) : 0;
                    return (
                      <tr 
                        key={row.profile.id} 
                        className={`transition-colors 
                          ${isLoggedUser ? 'bg-cyan-50/20 font-semibold text-cyan-950' : 'hover:bg-slate-50/40'}
                        `}
                      >
                        <td className="py-3 px-3">
                          <div className="flex items-center space-x-1.5">
                            <span className={`h-6 w-6 text-xs font-mono font-bold flex items-center justify-center rounded-full
                              ${index === 0 ? 'bg-amber-100 text-amber-800 font-sans' : 
                                index === 1 ? 'bg-slate-100 text-slate-800' : 
                                index === 2 ? 'bg-amber-150 text-amber-900 bg-amber-500/10' : 'bg-transparent text-slate-400'}
                            `}>
                              {index + 1}
                            </span>
                            {isLoggedUser && (
                              <span className="text-[8px] bg-cyan-100 text-cyan-800 px-1 rounded uppercase font-bold tracking-wide">
                                VOCÊ
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center space-x-2">
                            {row.profile.avatar_url ? (
                              <img 
                                src={row.profile.avatar_url} 
                                alt={row.profile.full_name} 
                                className="w-6 h-6 rounded-full border border-slate-200/60 object-cover shrink-0"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-bold flex items-center justify-center text-[10px] uppercase shrink-0">
                                {row.profile.full_name ? row.profile.full_name.substring(0, 1) : 'G'}
                              </div>
                            )}
                            <span className="font-semibold text-slate-800">{row.profile.full_name}</span>
                            {row.profile.role === 'admin' && (
                              <span className="text-[9px] bg-slate-100 text-slate-500 border border-slate-200 px-1 py-0.5 rounded font-bold uppercase shrink-0 font-sans">
                                Admin
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-500">
                          {getSectorName(row.profile.sector_id)}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-slate-500">
                          {row.emittedCount}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-semibold text-indigo-650">
                          {row.conversionsCount}
                        </td>
                        <td className="py-3 px-4 text-center font-mono">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            cRate >= 40 ? 'bg-emerald-50 text-emerald-700' : 
                            cRate >= 20 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {cRate}%
                          </span>
                        </td>
                        <td className="py-3 px-6 text-right font-mono font-bold text-slate-900 text-sm">
                          {row.points} <span className="text-[10px] text-slate-400 font-normal">pts</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Setores Leaderboard - Taking 1/3 column */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
          <div>
            <h3 className="font-sans font-bold text-base text-slate-800">Classificação por Setor</h3>
            <p className="text-xs text-slate-400 mt-0.5">Resultados agrupados dos colaboradores do hotel</p>
          </div>

          <div className="space-y-3">
            {leaderboard.sectors.length === 0 ? (
              <p className="text-center text-xs text-slate-450 py-8 text-slate-400">Nenhum setor encontrado.</p>
            ) : (
              leaderboard.sectors.map((row, index) => {
                const cRate = row.emittedCount > 0 ? Math.round((row.conversionsCount / row.emittedCount)*100) : 0;
                return (
                  <div key={row.sector.id} className="p-4 bg-slate-50/50 border border-slate-150 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <span className={`h-5 w-5 rounded-full font-mono font-bold text-[11px] flex items-center justify-center
                          ${index === 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-500'}
                        `}>
                          {index + 1}
                        </span>
                        <h4 className="font-bold text-xs text-slate-800">{row.sector.name}</h4>
                      </div>
                      
                      <span className="font-mono text-xs font-bold text-slate-900">
                        {row.points} pts
                      </span>
                    </div>

                    {/* Progress representation bar */}
                    <div className="space-y-1">
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-amber-500 h-full rounded-full transition-all duration-300" 
                          style={{ width: `${Math.min(100, (row.points / Math.max(1, leaderboard.sectors[0]?.points || 100)) * 100)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>{row.emittedCount} convites</span>
                        <span>{row.conversionsCount} feedbacks ({cRate}%)</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* WEIGHTS DESCRIPTION FOOTER BOX */}
      <div id="ranking-weights-info" className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start space-x-3 text-xs leading-relaxed max-w-full">
        <Info className="h-4.5 w-4.5 text-slate-500 mt-0.5 shrink-0" />
        <div id="weights-pnl-desc">
          <h4 className="font-semibold text-slate-800 uppercase tracking-wider text-[10px] mb-1">Campanha Guardiões: Regras de Pontuação</h4>
          <p className="text-slate-600 font-light text-[11px]">
            Os pontos são atribuídos de acordo com o canal de avaliação quando a conversão é certificada:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 pt-2.5 border-t border-slate-200 font-mono text-[10px]">
            <div>
              <p className="text-[#00AA6C] font-bold uppercase">Tripadvisor</p>
              <p className="font-bold text-slate-705">+{weights.platform_tripadvisor ?? 3} pontos</p>
            </div>
            <div>
              <p className="text-[#4285F4] font-bold uppercase">Google Reviews</p>
              <p className="font-bold text-slate-700">+{weights.platform_google ?? 2} pontos</p>
            </div>
            <div>
              <p className="text-[#1198db] font-bold uppercase">MyHotel NPS</p>
              <p className="font-bold text-slate-700">+{weights.platform_internal ?? 1} ponto</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
