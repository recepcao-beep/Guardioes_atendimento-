import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  PartyPopper, Plus, RefreshCw, Save, Sparkles, Star, Trash2, Trophy, X
} from 'lucide-react';
import { ApiService, DEFAULT_ROULETTE_OPTIONS } from '../../lib/api';
import { Profile, RouletteOption } from '../../types';

interface RouletteViewProps {
  user: Profile;
}

const makeOptionId = () => `roulette-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const wheelColors = ['#ff5a1f', '#101727', '#e24a1a', '#182235', '#f97316', '#0b1020', '#ea580c', '#1f2937'];

export default function RouletteView({ user }: RouletteViewProps) {
  const isAdmin = user.role === 'admin';
  const wheelRef = useRef<HTMLDivElement>(null);
  const [options, setOptions] = useState<RouletteOption[]>(DEFAULT_ROULETTE_OPTIONS);
  const [draftLabel, setDraftLabel] = useState('');
  const [winner, setWinner] = useState<RouletteOption | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [spinDegrees, setSpinDegrees] = useState(0);
  const [showFocus, setShowFocus] = useState(false);
  const [showPrizeModal, setShowPrizeModal] = useState(false);

  useEffect(() => {
    let mounted = true;
    ApiService.getRouletteOptions().then((loadedOptions) => {
      if (!mounted) return;
      setOptions(loadedOptions);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const activeOptions = useMemo(() => {
    return options.filter(option => option.active && option.label.trim());
  }, [options]);

  const segments = useMemo(() => {
    const pool = activeOptions.length > 0 ? activeOptions : DEFAULT_ROULETTE_OPTIONS;
    const segmentSize = 360 / pool.length;
    const gradient = pool.map((option, index) => {
      const start = index * segmentSize;
      const end = (index + 1) * segmentSize;
      return `${wheelColors[index % wheelColors.length]} ${start}deg ${end}deg`;
    }).join(', ');
    return { pool, segmentSize, gradient };
  }, [activeOptions]);

  const pickRandomOption = () => {
    const pool = activeOptions.length > 0 ? activeOptions : DEFAULT_ROULETTE_OPTIONS;
    return pool[Math.floor(Math.random() * pool.length)];
  };

  const spin = () => {
    if (spinning || activeOptions.length < 2) return;

    wheelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setWinner(null);
    setMessage(null);
    setShowPrizeModal(false);
    setShowFocus(true);
    setSpinning(true);

    const finalWinner = pickRandomOption();
    const winnerIndex = Math.max(0, segments.pool.findIndex(option => option.id === finalWinner.id));
    const targetCenter = winnerIndex * segments.segmentSize + segments.segmentSize / 2;
    const nextDegrees = spinDegrees + 1800 + (360 - targetCenter) + Math.floor(Math.random() * 28);
    setSpinDegrees(nextDegrees);

    window.setTimeout(() => {
      setWinner(finalWinner);
      setSpinning(false);
      setShowFocus(false);
      setShowPrizeModal(true);
    }, 4200);
  };

  const addOption = () => {
    const label = draftLabel.trim();
    if (!label) return;
    setOptions(prev => [...prev, { id: makeOptionId(), label, active: true }]);
    setDraftLabel('');
    setMessage(null);
  };

  const updateOption = (id: string, patch: Partial<RouletteOption>) => {
    setOptions(prev => prev.map(option => option.id === id ? { ...option, ...patch } : option));
  };

  const removeOption = (id: string) => {
    setOptions(prev => prev.filter(option => option.id !== id));
  };

  const saveOptions = async () => {
    setSaving(true);
    setMessage(null);
    const cleanOptions = options
      .map(option => ({ ...option, label: option.label.trim() }))
      .filter(option => option.label);

    const res = await ApiService.saveRouletteOptions(cleanOptions);
    if (res.error) {
      setMessage(res.error);
    } else {
      setOptions(cleanOptions);
      setMessage('Opcoes da roleta salvas com sucesso.');
    }
    setSaving(false);
  };

  const Wheel = ({ compact = false }: { compact?: boolean }) => (
    <div className={`relative mx-auto ${compact ? 'w-[82vw] max-w-[460px]' : 'w-full max-w-[540px]'}`}>
      <div className="absolute -top-4 left-1/2 z-30 -translate-x-1/2">
        <div className="rounded-t-xl border-4 border-white/80 bg-gradient-to-b from-yellow-200 to-orange-400 px-5 py-2 shadow-[0_0_22px_rgba(251,191,36,0.75)]">
          <div className="h-0 w-0 border-l-[22px] border-r-[22px] border-t-[30px] border-l-transparent border-r-transparent border-t-yellow-300" />
        </div>
      </div>

      <div
        className={`relative aspect-square rounded-full p-4 sm:p-5 md:p-6 bg-gradient-to-br from-orange-300 via-orange-700 to-slate-950 shadow-[0_0_55px_rgba(249,115,22,0.52)] ${spinning ? 'scale-[1.015]' : ''} transition-transform duration-300`}
      >
        <div className="absolute inset-0 rounded-full border-[12px] border-orange-500/80 shadow-[inset_0_0_26px_rgba(0,0,0,0.55)]" />
        <div className="absolute inset-[7%] rounded-full border border-yellow-300/40" />
        <div
          className="relative h-full w-full rounded-full border-[8px] border-orange-200/90 overflow-hidden will-change-transform"
          style={{
            transform: spinning ? undefined : `rotate(${spinDegrees}deg)`,
            animation: spinning ? 'roulette-spin 0.62s linear infinite' : undefined,
            background: `conic-gradient(${segments.gradient})`,
            boxShadow: 'inset 0 0 34px rgba(0,0,0,0.42)'
          }}
        >
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,transparent_0_58%,rgba(255,255,255,0.10)_58.5%,transparent_60%)]" />
          {segments.pool.map((option, index) => {
            const angle = index * segments.segmentSize + segments.segmentSize / 2;
            return (
              <div
                key={option.id}
                className="absolute inset-0 origin-center"
                style={{ transform: `rotate(${angle}deg)` }}
              >
                <span
                  className="absolute left-1/2 top-[8%] block w-[34%] -translate-x-1/2 text-center text-[8px] sm:text-[10px] md:text-[11px] font-black uppercase leading-tight tracking-[0.14em] text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.65)]"
                >
                  {option.label}
                </span>
              </div>
            );
          })}
          <div className="absolute inset-[25%] rounded-full border-[7px] border-emerald-400/90 bg-slate-950/50 shadow-[inset_0_0_20px_rgba(0,0,0,0.6)]" />
          <div className="absolute inset-[36%] rounded-full border border-white/15 bg-orange-500/70" />
        </div>

        <div className="absolute inset-[43%] rounded-full bg-yellow-300 border-4 border-orange-500 shadow-[0_0_22px_rgba(251,191,36,0.95)] z-20" />
      </div>
    </div>
  );

  return (
    <div id="roulette-page" className="space-y-6 max-w-6xl mx-auto animate-fade-in">
      <style>{`
        @keyframes roulette-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-150 dark:border-slate-800 pb-5">
        <div>
          <span className="inline-flex items-center gap-2 px-3 py-1 text-[10px] uppercase font-mono font-extrabold tracking-wider bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 rounded-full">
            <Sparkles className="h-3.5 w-3.5" />
            Campanha de recompensas
          </span>
          <h2 className="font-sans font-extrabold text-2xl md:text-3xl text-slate-800 dark:text-slate-100 tracking-tight mt-3">
            Roleta da Sorte
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-2xl">
            Sorteio rapido de brindes e experiencias para manter a campanha viva durante o atendimento.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Trophy className="h-4 w-4 text-orange-500" />
          <span>{activeOptions.length} opcoes ativas</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section
          ref={wheelRef}
          className="xl:col-span-2 rounded-[28px] border border-orange-500/20 p-5 md:p-8 shadow-xl text-white overflow-hidden relative bg-[radial-gradient(circle_at_top,rgba(127,29,29,0.96),#080a18_58%,#050712)]"
        >
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_15%,rgba(249,115,22,0.65),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(220,38,38,0.55),transparent_25%)]" />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-orange-600/35 to-transparent" />

          <div className="relative z-10 space-y-7 text-center">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-200">Guardioes</p>
              <h3 className="font-sans font-black text-2xl text-white drop-shadow">Roda da Sorte</h3>
            </div>

            <Wheel />

            <button
              type="button"
              onClick={spin}
              disabled={spinning || activeOptions.length < 2}
              className="mx-auto h-14 min-w-48 rounded-full border-4 border-white/80 bg-gradient-to-b from-orange-400 to-orange-700 px-9 text-white font-sans font-black text-lg tracking-wide shadow-[0_12px_30px_rgba(249,115,22,0.42)] hover:from-orange-300 hover:to-orange-600 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {spinning ? 'GIRANDO...' : 'JOGAR'}
            </button>

            {winner && (
              <div className="mx-auto max-w-sm rounded-2xl border border-orange-300/30 bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-[10px] font-mono uppercase tracking-widest text-orange-200">Ultimo premio</p>
                <p className="text-lg font-extrabold text-white">{winner.label}</p>
              </div>
            )}
          </div>
        </section>

        <aside className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
          <div>
            <h3 className="font-sans font-bold text-base text-slate-800 dark:text-slate-100">Opcoes da roleta</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {isAdmin ? 'Adicione, remova ou desative premios da campanha.' : 'Premios configurados para a campanha atual.'}
            </p>
          </div>

          {message && (
            <div className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
              message.includes('sucesso')
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}>
              {message}
            </div>
          )}

          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {options.map(option => (
              <div key={option.id} className="flex items-center gap-2 rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-2">
                <input
                  type="checkbox"
                  checked={option.active}
                  disabled={!isAdmin}
                  onChange={(e) => updateOption(option.id, { active: e.target.checked })}
                  className="h-4 w-4 accent-orange-500"
                />
                <input
                  type="text"
                  value={option.label}
                  disabled={!isAdmin}
                  onChange={(e) => updateOption(option.id, { label: e.target.value })}
                  className="min-w-0 flex-1 bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 outline-none disabled:opacity-100"
                />
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => removeOption(option.id)}
                    className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                    aria-label="Remover opcao"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {isAdmin && (
            <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={draftLabel}
                  onChange={(e) => setDraftLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addOption();
                    }
                  }}
                  placeholder="Nova opcao"
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs outline-none focus:border-orange-500 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={addOption}
                  className="h-9 w-9 rounded-xl bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center hover:bg-slate-800 transition-colors"
                  aria-label="Adicionar opcao"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={saveOptions}
                disabled={saving}
                className="w-full h-11 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-sans font-black text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
              >
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span>{saving ? 'Salvando...' : 'Salvar opcoes'}</span>
              </button>
            </div>
          )}
        </aside>
      </div>

      {showFocus && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
          <div className="w-full max-w-xl text-center space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-orange-200">
              <Star className="h-4 w-4 fill-orange-300" />
              Boa sorte
            </div>
            <Wheel compact />
            <p className="text-sm font-bold text-white/80">A roleta esta escolhendo o premio...</p>
          </div>
        </div>
      )}

      {showPrizeModal && winner && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-orange-300/40 bg-gradient-to-br from-orange-500 via-orange-600 to-slate-950 p-7 text-center text-white shadow-[0_30px_80px_rgba(249,115,22,0.45)]">
            <button
              type="button"
              onClick={() => setShowPrizeModal(false)}
              className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white/80 hover:bg-white/20"
              aria-label="Fechar resultado"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-white/10" />
            <div className="absolute -right-12 bottom-4 h-36 w-36 rounded-full bg-amber-300/10" />

            <div className="relative z-10 space-y-5">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white text-orange-600 shadow-xl">
                <PartyPopper className="h-10 w-10" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.35em] text-orange-100">Resultado da roleta</p>
                <h3 className="mt-2 font-sans text-4xl font-black tracking-tight">PARABENS!</h3>
              </div>
              <div className="rounded-2xl border border-white/25 bg-white/15 p-5 backdrop-blur-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-orange-100">Voce ganhou</p>
                <p className="mt-1 text-2xl font-black text-white">{winner.label}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPrizeModal(false)}
                className="h-12 w-full rounded-full bg-white text-orange-700 font-sans font-black text-sm shadow-lg hover:bg-orange-50 transition-colors"
              >
                Comemorar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
