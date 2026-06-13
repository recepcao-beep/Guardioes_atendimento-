import React, { useState, useMemo } from 'react';
import { 
  BarChart3, Users, HelpCircle, FileCheck, Percent, 
  Filter, Calendar, ExternalLink, RefreshCw, Trophy, Crown, 
  Sparkles, CheckCircle2, TrendingUp, HelpCircle as QrIcon
} from 'lucide-react';
import { 
  Sector, Profile, Platform, ReviewInvite, 
  InternalReview, ExternalReviewConfirmation, MonthlyPrize 
} from '../../types';
import MonthlyPrizeCard from '../MonthlyPrizeCard';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar 
} from 'recharts';
import { DemoDb } from '../../utils/demoDb';

interface DashboardViewProps {
  user: Profile;
  sectors: Sector[];
  profiles: Profile[];
  platforms: Platform[];
  invites: ReviewInvite[];
  internalReviews: InternalReview[];
  confirmations: ExternalReviewConfirmation[];
  prizes: MonthlyPrize[];
  weights: Record<string, number>;
  navigate: (path: string) => void;
  darkMode?: boolean;
}

export default function DashboardView({
  user, sectors, profiles, platforms, invites, 
  internalReviews, confirmations, prizes, weights, navigate,
  darkMode
}: DashboardViewProps) {
  
  const isAdmin = user.role === 'admin';

  // Dynamic Chart Theme Colors based on darkMode status
  const isDark = !!darkMode;
  const gridColor = isDark ? '#1e293b' : '#f1f5f9';
  const textTickColor = isDark ? '#94a3b8' : '#64748b';
  const tooltipBg = isDark ? '#1e293b' : '#ffffff';
  const tooltipBorder = isDark ? '#334155' : '#e2e8f0';
  const tooltipTextColor = isDark ? '#f8fafc' : '#0f172a';

  // State Filters
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all'); // all, 7d, 30d
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [selectedGuardian, setSelectedGuardian] = useState<string>('all');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');

  // If guardian, force filtering for sector or display customized own values!
  const guardianProfile = !isAdmin ? user : null;

  // Active prize helper
  const activePrize = useMemo(() => {
    return prizes.find(p => p.active) || null;
  }, [prizes]);

  // Handle resetting filters
  const handleResetFilters = () => {
    setSelectedPeriod('all');
    setSelectedSector('all');
    setSelectedGuardian('all');
    setSelectedPlatform('all');
  };

  // --- FILTERED DATA PIPELINE ---
  const filteredInvites = useMemo(() => {
    let result = [...invites];

    // If guardian is logged in, they can view either general lists or specifically their sector / profile bounds
    // The user prompts ask to: "Para guardiões: Exibir ranking geral permitido, destacar própria posição, exibir próprios números e desempenho do próprio setor"
    // So on general metrics view, we can let guardians filter to see theirs, or filter globally, but highlight their numbers first.
    // Let's filter based on dropdowns
    if (selectedSector !== 'all') {
      result = result.filter(i => i.issuer_sector_id === selectedSector);
    }
    if (selectedGuardian !== 'all') {
      result = result.filter(i => i.issuer_user_id === selectedGuardian);
    }
    if (selectedPlatform !== 'all') {
      const plat = platforms.find(p => p.code === selectedPlatform);
      if (plat) {
        result = result.filter(i => i.platform_id === plat.id);
      }
    }

    // Period filtering
    if (selectedPeriod !== 'all') {
      const d = new Date();
      if (selectedPeriod === '7d') {
        d.setDate(d.getDate() - 7);
      } else if (selectedPeriod === '30d') {
        d.setDate(d.getDate() - 30);
      }
      result = result.filter(i => new Date(i.created_at) >= d);
    }

    return result;
  }, [invites, selectedPeriod, selectedSector, selectedGuardian, selectedPlatform, platforms]);

  // --- CORE COMPUTED VALUES FOR STATS CARDS ---
  const stats = useMemo(() => {
    // Determine metrics based on current filtered dataset
    const emitted = filteredInvites.length;
    const opened = filteredInvites.filter(i => i.opened_count > 0).length;
    
    const internalCompleted = filteredInvites.filter(i => i.status === 'internal_completed').length;
    const externalConfirmed = filteredInvites.filter(i => 
      ['externally_verified_manual', 'externally_reconciled'].includes(i.status)
    ).length;

    const totalConversions = internalCompleted + externalConfirmed;
    const conversionRate = emitted > 0 ? Math.round((totalConversions / emitted) * 100) : 0;

    return {
      emitted,
      opened,
      internalCompleted,
      externalConfirmed,
      totalConversions,
      conversionRate
    };
  }, [filteredInvites]);

  // Guardian or Sector Leader computation
  const leaderboard = useMemo(() => {
    // 1. Individual points
    const pointsMap: Record<string, { points: number; profile: Profile; conversions: number; emitted: number; opened: number }> = {};
    
    // Seed profiles
    profiles.forEach(p => {
      pointsMap[p.id] = { points: 0, profile: p, conversions: 0, emitted: 0, opened: 0 };
    });

    invites.forEach(inv => {
      const emitterId = inv.issuer_user_id;
      if (!pointsMap[emitterId]) return;

      pointsMap[emitterId].emitted += 1;
      if (inv.opened_count > 0) pointsMap[emitterId].opened += 1;

      if (['internal_completed', 'externally_verified_manual', 'externally_reconciled'].includes(inv.status)) {
        pointsMap[emitterId].conversions += 1;
        pointsMap[emitterId].points += DemoDb.calculatePoints(inv.status, weights, inv.platform_id);
      }
    });

    const indRank = Object.values(pointsMap)
      .filter(x => x.profile.active)
      .sort((a, b) => b.points - a.points || b.conversions - a.conversions);

    // 2. Sector leading points
    const sectorMap: Record<string, { points: number; sector: Sector; conversions: number; emitted: number }> = {};
    sectors.forEach(s => {
      sectorMap[s.id] = { points: 0, sector: s, conversions: 0, emitted: 0 };
    });

    invites.forEach(inv => {
      const secId = inv.issuer_sector_id;
      if (!secId || !sectorMap[secId]) return;

      sectorMap[secId].emitted += 1;
      if (['internal_completed', 'externally_verified_manual', 'externally_reconciled'].includes(inv.status)) {
        sectorMap[secId].conversions += 1;
        sectorMap[secId].points += DemoDb.calculatePoints(inv.status, weights, inv.platform_id);
      }
    });

    const secRank = Object.values(sectorMap)
      .filter(x => x.sector.active)
      .sort((a, b) => b.points - a.points || b.conversions - a.conversions);

    return {
      individual: indRank,
      sectors: secRank,
      topGuardian: indRank[0] || null,
      topSector: secRank[0] || null
    };
  }, [invites, profiles, sectors, weights]);

  // Own stats (for Guardian layout)
  const ownPerformance = useMemo(() => {
    if (!guardianProfile) return null;

    const myInvites = invites.filter(i => i.issuer_user_id === guardianProfile.id);
    const myEmitted = myInvites.length;
    const myConversions = myInvites.filter(i => 
      ['internal_completed', 'externally_verified_manual', 'externally_reconciled'].includes(i.status)
    ).length;
    const myConversionRate = myEmitted > 0 ? Math.round((myConversions / myEmitted) * 100) : 0;
    
    // Find my spot in individual ranking
    const rankIndex = leaderboard.individual.findIndex(x => x.profile.id === guardianProfile.id);
    const myRank = rankIndex !== -1 ? rankIndex + 1 : '-';
    const myScore = rankIndex !== -1 ? leaderboard.individual[rankIndex].points : 0;

    // My sector statistics
    const mySectorId = guardianProfile.sector_id;
    let sectorRankSpot = '-';
    let sectorTotalScore = 0;
    if (mySectorId) {
      const secIdx = leaderboard.sectors.findIndex(x => x.sector.id === mySectorId);
      sectorRankSpot = secIdx !== -1 ? String(secIdx + 1) : '-';
      sectorTotalScore = secIdx !== -1 ? leaderboard.sectors[secIdx].points : 0;
    }

    return {
      emitted: myEmitted,
      conversions: myConversions,
      rate: myConversionRate,
      rank: myRank,
      score: myScore,
      sectorRank: sectorRankSpot,
      sectorScore: sectorTotalScore,
      sectorName: sectors.find(s => s.id === mySectorId)?.name || 'Sem Setor'
    };
  }, [guardianProfile, invites, leaderboard, sectors]);

  // --- RECHARTS CHART DATA PREPARATION ---
  const chartData = useMemo(() => {
    // Generate dates over past 10 days for readable plotting
    const dataset: Record<string, { dateLabel: string; emitidos: number; conversoes: number }> = {};
    const d = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const past = new Date();
      past.setDate(d.getDate() - i);
      const key = past.toISOString().split('T')[0];
      const label = past.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
      dataset[key] = { dateLabel: label, emitidos: 0, conversoes: 0 };
    }

    filteredInvites.forEach(inv => {
      const dayKey = inv.created_at.split('T')[0];
      if (dataset[dayKey]) {
        dataset[dayKey].emitidos += 1;
        if (['internal_completed', 'externally_verified_manual', 'externally_reconciled'].includes(inv.status)) {
          dataset[dayKey].conversoes += 1;
        }
      }
    });

    return Object.values(dataset);
  }, [filteredInvites]);

  // Bar chart by platforms
  const barChartData = useMemo(() => {
    return platforms.map(plat => {
      const platInvites = filteredInvites.filter(i => i.platform_id === plat.id);
      const conversions = platInvites.filter(i => 
        ['internal_completed', 'externally_verified_manual', 'externally_reconciled'].includes(i.status)
      ).length;
      return {
        name: plat.name.replace(' Avaliações', '').replace(' (NPS)', ''),
        'Convites Emitidos': platInvites.length,
        'Conversões Confirmadas': conversions
      };
    });
  }, [filteredInvites, platforms]);

  return (
    <div id="dashboard-container" className="space-y-6">
      
      {/* Upper welcoming bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-sans font-extrabold text-2xl text-slate-800 tracking-wide">
            {isAdmin ? 'Painel Executivo de Operações' : `Olá de Boas-vindas, ${user.full_name}!`}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isAdmin ? 'Monitore e audite em tempo real avaliações, QR Codes e engajamento.' : 'Monitore seus convites de avaliação e veja sua classificação.'}
          </p>
        </div>

        {/* Quick action to manual conciliation if admin */}
        {isAdmin && (
          <button
            onClick={() => navigate('/configuracoes/conciliacao')}
            id="btn-goto-conciliation"
            className="flex items-center space-x-2 bg-gradient-to-r from-amber-600 to-amber-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-semibold hover:from-amber-500 hover:to-amber-400 transition-colors shadow-sm focus:outline-none shrink-0"
          >
            <Trophy className="h-4 w-4" />
            <span>Painel de Conciliação</span>
          </button>
        )}
      </div>

      {/* 1. MONTHLY PRIZE EMBEDDED BANNER */}
      <MonthlyPrizeCard prize={activePrize} sectors={sectors} />

      {/* 2. GUARDIAN CUSTOM PERFORMANCE (HIGHLIGHTED FOR GUARDIANS ONLY) */}
      {!isAdmin && ownPerformance && (
        <div id="guardian-highlight-widget" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
          <div className="bg-gradient-to-tr from-slate-900 to-slate-800 text-amber-100 p-5 rounded-2xl border border-slate-700 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono tracking-wider uppercase">Sua Posição</span>
              <Crown className="h-5 w-5 text-amber-400" />
            </div>
            <div className="mt-3 flex items-baseline space-x-2">
              <span className="text-4xl font-sans font-black text-amber-300">#{ownPerformance.rank}</span>
              <span className="text-xs text-slate-400">lugar geral</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 font-mono">
              Pontuação Acumulada: <strong className="text-amber-400 font-bold">{ownPerformance.score} pts</strong>
            </p>
          </div>

          <div className="bg-gradient-to-tr from-slate-900 to-slate-800 text-cyan-100 p-5 rounded-2xl border border-slate-700 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono tracking-wider uppercase">Seu Setor ({ownPerformance.sectorName})</span>
              <BarChart3 className="h-5 w-5 text-cyan-400" />
            </div>
            <div className="mt-3 flex items-baseline space-x-2">
              <span className="text-4xl font-sans font-black text-cyan-300">#{ownPerformance.sectorRank}</span>
              <span className="text-xs text-slate-400">lugar geral</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 font-mono">
              Total do Setor: <strong className="text-cyan-300 font-bold">{ownPerformance.sectorScore} pts</strong>
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between text-slate-800 dark:text-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 dark:text-slate-500 font-mono tracking-wider uppercase font-semibold">Seus Convites</span>
              <div className="p-1.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-350 rounded-lg">
                <QrIcon className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="mt-2.5">
              <span className="text-3xl font-sans font-black text-slate-800 dark:text-slate-100">{ownPerformance.emitted}</span>
              <p className="text-[11px] text-slate-400 dark:text-slate-550 mt-0.5">emitidos no total</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between text-slate-800 dark:text-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 dark:text-slate-500 font-mono tracking-wider uppercase font-semibold">Suas Conversões</span>
              <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
                <CheckCircle2 className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-sans font-black text-slate-800 dark:text-slate-100">{ownPerformance.conversions}</span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-mono bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded">
                  {ownPerformance.rate}%
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-550 mt-0.5">avaliações preenchidas</p>
            </div>
          </div>
        </div>
      )}

      {/* 3. CORE ANALYTICAL CHIP COUNTERS */}
      <div id="analytical-counters" className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
        
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between text-slate-800 dark:text-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 dark:text-slate-500 uppercase font-mono tracking-wider">
              {isAdmin ? 'Convites Emitidos' : 'Parcial Filtrada'}
            </span>
            <QrIcon className="h-4.5 w-4.5 text-slate-400 dark:text-slate-500" />
          </div>
          <div className="mt-3">
            <span className="text-2xl md:text-3xl font-sans font-black text-slate-800 dark:text-slate-100">{stats.emitted}</span>
            <p className="text-[10px] text-slate-400 dark:text-slate-550 mt-0.5">links {selectedPlatform !== 'all' ? selectedPlatform : 'gerais'}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between text-slate-800 dark:text-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 dark:text-slate-500 uppercase font-mono tracking-wider">Links Acessados</span>
            <ExternalLink className="h-4.5 w-4.5 text-cyan-500" />
          </div>
          <div className="mt-3">
            <span className="text-2xl md:text-3xl font-sans font-black text-slate-800 dark:text-slate-100">{stats.opened}</span>
            <p className="text-[10px] text-slate-400 dark:text-slate-550 mt-0.5">
              Abertura de QRCode/Whats
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between text-slate-800 dark:text-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 dark:text-slate-500 uppercase font-mono tracking-wider">Avaliações Completas</span>
            <FileCheck className="h-4.5 w-4.5 text-emerald-500" />
          </div>
          <div className="mt-3">
            <span className="text-2xl md:text-3xl font-sans font-black text-slate-800 dark:text-slate-100">
              {stats.totalConversions}
            </span>
            <p className="text-[10px] text-slate-400 dark:text-slate-550 mt-0.5">
              {stats.internalCompleted} MyHotel / {stats.externalConfirmed} listadas
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between text-slate-800 dark:text-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 dark:text-slate-500 uppercase font-mono tracking-wider">Conversão Média</span>
            <Percent className="h-4.5 w-4.5 text-amber-500" />
          </div>
          <div className="mt-3">
            <span className="text-2xl md:text-3xl font-sans font-black text-slate-800 dark:text-slate-100">{stats.conversionRate}%</span>
            <p className="text-[10px] text-slate-400 dark:text-slate-550 mt-0.5">
              Média geral do hotel
            </p>
          </div>
        </div>

      </div>

      {/* 4. FILTER CONTROLLER ACCORDION OR HEADER BAR */}
      <div id="filter-controls" className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
          <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-200">
            <Filter className="h-4.5 w-4.5 text-slate-500 dark:text-slate-400" />
            <span className="text-xs font-bold uppercase tracking-wider">Filtragem e Auditoria</span>
          </div>
          <button 
            onClick={handleResetFilters}
            className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-500 font-mono flex items-center space-x-1 cursor-pointer"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Limpar Filtros</span>
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Calendar Period dropdown */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Período</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none p-2 rounded-lg text-slate-750 dark:text-slate-100"
            >
              <option value="all">Todo Histórico</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
            </select>
          </div>

          {/* Sector filter */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Setor do Hotel</label>
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none p-2 rounded-lg text-slate-750 dark:text-slate-100"
            >
              <option value="all">Todos os setores</option>
              {sectors.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Emitter / Guardian filter */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Guardião Emissor</label>
            <select
              value={selectedGuardian}
              onChange={(e) => setSelectedGuardian(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none p-2 rounded-lg text-slate-755 dark:text-slate-100"
            >
              <option value="all">Todos os guardiões</option>
              {profiles.filter(p => p.role === 'guardian').map(g => (
                <option key={g.id} value={g.id}>{g.full_name}</option>
              ))}
            </select>
          </div>

          {/* Platform filter */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Plataforma</label>
            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none p-2 rounded-lg text-slate-755 dark:text-slate-100"
            >
              <option value="all">Todas as plataformas</option>
              {platforms.map(p => (
                <option key={p.id} value={p.code}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 5. INTERACTIVE ANALYTICAL CHARTS (RECHARTS) */}
      <div id="analytical-charts" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Core Line / Area conversions over past days */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-sans font-bold text-sm text-slate-800 dark:text-slate-105 dark:text-slate-100">
                Acompanhamento Diário de Conversões
              </h4>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                Relação entre emissões e feedbacks preenchidos no período
              </p>
            </div>
            <span className="flex items-center space-x-1 text-slate-500 dark:text-slate-300 px-2 py-0.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded text-[10px] font-medium uppercase">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              <span>Tendência</span>
            </span>
          </div>

          <div className="h-64 mt-4 text-[10px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                   <linearGradient id="colorEmitidos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorConversoes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis dataKey="dateLabel" axisLine={false} tickLine={false} stroke={textTickColor} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} stroke={textTickColor} />
                <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid ' + tooltipBorder, backgroundColor: tooltipBg, color: tooltipTextColor }} labelStyle={{ color: textTickColor }} />
                <Area 
                  type="monotone" 
                  name="Emitidos"
                  dataKey="emitidos" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorEmitidos)" 
                />
                <Area 
                  type="monotone" 
                  name="Conversões"
                  dataKey="conversoes" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorConversoes)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Platform bar distribution */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
          <div>
            <h4 className="font-sans font-bold text-sm text-slate-800 dark:text-slate-101 dark:text-slate-100">
              Desempenho por Plataforma
            </h4>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
              Volume absoluto capturado por canal
            </p>
          </div>

          <div className="h-64 mt-4 text-[10px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} stroke={textTickColor} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} stroke={textTickColor} />
                <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid ' + tooltipBorder, backgroundColor: tooltipBg, color: tooltipTextColor }} labelStyle={{ color: textTickColor }} />
                <Bar name="Emitido" dataKey="Convites Emitidos" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar name="Convertido" dataKey="Conversões Confirmadas" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* 6. DOUBLE SUMMARY LEADERS LISTS */}
      <div id="summarized-rankings" className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
        
        {/* Sector summarized leaderboard */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h4 className="font-sans font-bold text-sm text-slate-800">Ranking Resumido por Setor</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Classificação do desempenho coletivo das equipes</p>
            </div>
            <Trophy className="h-4.5 w-4.5 text-amber-500" />
          </div>

          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {leaderboard.sectors.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-6">Nenhum setor computado.</p>
            ) : (
              leaderboard.sectors.map((row, index) => (
                <div 
                  key={row.sector.id}
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-colors
                    ${index === 0 ? 'bg-amber-50/20 border-amber-200' : 'bg-slate-50/50 border-slate-100 hover:bg-slate-50'}
                  `}
                >
                  <div className="flex items-center space-x-3.5">
                    <span className={`h-6 w-6 font-mono font-bold flex items-center justify-center rounded-full text-[11px]
                      ${index === 0 ? 'bg-amber-100 text-amber-800 font-sans text-xs' : 
                        index === 1 ? 'bg-slate-200 text-slate-850' : 
                        index === 2 ? 'bg-amber-700/10 text-amber-900' : 'bg-slate-200/50 text-slate-400'}
                    `}>
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-slate-700">{row.sector.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {row.emitted} convites | {row.conversions} feedbacks
                      </p>
                    </div>
                  </div>
                  
                  <span className="font-mono text-sm font-bold text-slate-800">
                    {row.points} <span className="text-[10px] text-slate-400 font-normal">pts</span>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Individual summarized leaderboard */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h4 className="font-sans font-bold text-sm text-slate-800">Ranking Resumido Individual</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Destaques individuais de Guardiões do atendimento</p>
            </div>
            <Crown className="h-4.5 w-4.5 text-amber-500 animate-pulse" />
          </div>

          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {leaderboard.individual.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-6">Nenhum colaborador computado.</p>
            ) : (
              leaderboard.individual.map((row, index) => {
                const isLoggedGuardian = row.profile.id === user.id;
                return (
                  <div 
                    key={row.profile.id}
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-colors
                      ${isLoggedGuardian ? 'bg-cyan-50/20 border-cyan-200 ring-1 ring-cyan-500/20' : 
                        index === 0 ? 'bg-amber-50/20 border-amber-200 shadow-sm' : 'bg-slate-50/50 border-slate-100 hover:bg-slate-50'}
                    `}
                  >
                    <div className="flex items-center space-x-3.5">
                      <span className={`h-6 w-6 font-mono font-bold flex items-center justify-center rounded-full text-[11px]
                        ${index === 0 ? 'bg-amber-100 text-amber-800 font-sans text-xs' : 
                          index === 1 ? 'bg-slate-200 text-slate-800' : 
                          index === 2 ? 'bg-amber-700/10 text-amber-950' : 'bg-slate-200/50 text-slate-400'}
                      `}>
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-semibold text-slate-700 flex items-center space-x-1">
                          <span>{row.profile.full_name}</span>
                          {isLoggedGuardian && (
                            <span className="text-[9px] font-bold bg-cyan-100 text-cyan-800 px-1.5 py-0.2 rounded uppercase ml-1.5">
                              Você
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Setor: {sectors.find(s => s.id === row.profile.sector_id)?.name || 'Sem Setor'}
                        </p>
                      </div>
                    </div>
                    
                    <span className="font-mono text-sm font-bold text-slate-800">
                      {row.points} <span className="text-[10px] text-slate-400 font-normal">pts</span>
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
