import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Ban, Bell, Coffee, Gift, Home, PartyPopper, Plus, RefreshCw, Save,
  Sparkles, Star, Trash2, Trophy, Utensils, Wine, X
} from 'lucide-react';
import { ApiService, DEFAULT_ROULETTE_OPTIONS } from '../../lib/api';
import { Profile, RouletteOption } from '../../types';

interface RouletteViewProps {
  user: Profile;
}

const makeOptionId = () => `roulette-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const wheelColors = ['#25c7b6', '#061728', '#158f85', '#082035', '#1eb09d', '#0d2e34', '#3dd8c7', '#0a1727'];

const normalizePrize = (label: string) => label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const prizeIconFor = (label: string) => {
  const normalized = normalizePrize(label);
  if (normalized.includes('nada')) return Ban;
  if (normalized.includes('late') || normalized.includes('check')) return Bell;
  if (normalized.includes('espumante')) return Wine;
  if (normalized.includes('fond')) return Utensils;
  if (normalized.includes('cafe')) return Coffee;
  if (normalized.includes('quarto') || normalized.includes('upgrade')) return Home;
  return Gift;
};

export default function RouletteView({ user }: RouletteViewProps) {
  const isAdmin = user.role === 'admin';
  const wheelRef = useRef<HTMLDivElement>(null);
  const spinFrameRef = useRef<number | null>(null);
  const spinTimeoutRef = useRef<number | null>(null);
  const [options, setOptions] = useState<RouletteOption[]>(DEFAULT_ROULETTE_OPTIONS);
  const [draftLabel, setDraftLabel] = useState('');
  const [winner, setWinner] = useState<RouletteOption | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [spinDegrees, setSpinDegrees] = useState(0);
  const [wheelTransitionEnabled, setWheelTransitionEnabled] = useState(false);
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

  useEffect(() => {
    return () => {
      if (spinFrameRef.current !== null) window.cancelAnimationFrame(spinFrameRef.current);
      if (spinTimeoutRef.current !== null) window.clearTimeout(spinTimeoutRef.current);
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

  const canSpin = segments.pool.length >= 2;

  const pickRandomOption = () => {
    return segments.pool[Math.floor(Math.random() * segments.pool.length)];
  };

  const spin = () => {
    if (spinning) return;
    if (!canSpin) {
      setMessage('Cadastre pelo menos duas opcoes ativas para girar a roleta.');
      return;
    }

    wheelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (spinFrameRef.current !== null) window.cancelAnimationFrame(spinFrameRef.current);
    if (spinTimeoutRef.current !== null) window.clearTimeout(spinTimeoutRef.current);
    setWinner(null);
    setMessage(null);
    setShowPrizeModal(false);
    setShowFocus(true);
    setSpinning(true);
    setWheelTransitionEnabled(false);

    const finalWinner = pickRandomOption();
    const winnerIndex = Math.max(0, segments.pool.findIndex(option => option.id === finalWinner.id));
    const currentRotation = ((spinDegrees % 360) + 360) % 360;
    const wobble = (Math.random() - 0.5) * segments.segmentSize * 0.36;
    const targetCenter = winnerIndex * segments.segmentSize + segments.segmentSize / 2 + wobble;
    const targetRotation = (360 - targetCenter + 360) % 360;
    const distanceToTarget = (targetRotation - currentRotation + 360) % 360;
    const fullTurns = 7 + Math.floor(Math.random() * 3);
    const nextDegrees = spinDegrees + fullTurns * 360 + distanceToTarget;

    spinFrameRef.current = window.requestAnimationFrame(() => {
      spinFrameRef.current = window.requestAnimationFrame(() => {
        setWheelTransitionEnabled(true);
        setSpinDegrees(nextDegrees);
      });
    });

    spinTimeoutRef.current = window.setTimeout(() => {
      setWinner(finalWinner);
      setSpinning(false);
      setWheelTransitionEnabled(false);
      setShowFocus(false);
      setShowPrizeModal(true);
    }, 5900);
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
    <div className={`relative mx-auto ${compact ? 'w-[86vw] max-w-[520px]' : 'w-full max-w-[660px]'}`}>
      <div className="absolute -top-3 left-1/2 z-40 -translate-x-1/2 sm:-top-5">
        <div className="rounded-[18px] border-2 border-cyan-100/80 bg-gradient-to-b from-[#35f4de] via-[#0b8b81] to-[#04343d] px-6 py-3 shadow-[0_0_28px_rgba(63,255,226,0.95),inset_0_0_18px_rgba(255,255,255,0.35)]">
          <div className="h-0 w-0 border-l-[26px] border-r-[26px] border-t-[38px] border-l-transparent border-r-transparent border-t-white drop-shadow-[0_0_14px_rgba(255,255,255,0.95)]" />
        </div>
      </div>

      <div className={`relative aspect-square rounded-full p-[7%] transition-transform duration-300 ${spinning ? 'scale-[1.025]' : ''}`}>
        <div className="absolute inset-0 rounded-full border border-[#8dfff0]/60 bg-[radial-gradient(circle_at_50%_50%,rgba(34,211,188,0.20),rgba(5,18,31,0.92)_66%,rgba(10,65,75,0.86))] shadow-[0_0_44px_rgba(45,245,219,0.55),inset_0_0_44px_rgba(0,0,0,0.72)]" />
        <div className="absolute inset-[5.2%] rounded-full border-[10px] border-[#41d8c9] shadow-[0_0_30px_rgba(65,216,201,0.86),inset_0_0_22px_rgba(0,0,0,0.65)]" />
        <div className="absolute inset-[2%] rounded-full border border-[#b7fff7]/50" />

        {[20, 90, 160, 220, 300].map((angle) => {
          const radians = (angle * Math.PI) / 180;
          return (
            <span
              key={angle}
              className="absolute h-3.5 w-3.5 rounded-full border-2 border-[#99fff2]/70 bg-[#1eb09d] shadow-[0_0_12px_rgba(77,255,231,0.85)]"
              style={{
                left: `${50 + Math.sin(radians) * 46}%`,
                top: `${50 - Math.cos(radians) * 46}%`,
                transform: 'translate(-50%, -50%)'
              }}
            />
          );
        })}

        <div
          className="relative h-full w-full overflow-hidden rounded-full border-[2px] border-[#cffff8]/70 will-change-transform"
          style={{
            transform: `rotate(${spinDegrees}deg)`,
            transition: spinning && wheelTransitionEnabled ? 'transform 5.6s cubic-bezier(0.08, 0.78, 0.08, 1)' : 'transform 0.45s ease-out',
            background: `conic-gradient(${segments.gradient})`,
            boxShadow: 'inset 0 0 46px rgba(0,0,0,0.52)'
          }}
        >
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,transparent_0_55%,rgba(180,255,246,0.16)_55.4%,transparent_57%)]" />
          <div className="absolute inset-0 rounded-full bg-[linear-gradient(90deg,rgba(255,255,255,0.13),transparent_18%,transparent_82%,rgba(255,255,255,0.08))]" />

          {segments.pool.map((option, index) => {
            const angle = index * segments.segmentSize + segments.segmentSize / 2;
            const radians = ((angle - 90) * Math.PI) / 180;
            const Icon = prizeIconFor(option.label);
            return (
              <div
                key={option.id}
                className="absolute flex w-[34%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5 text-center sm:gap-2"
                style={{
                  left: `${50 + Math.cos(radians) * 31}%`,
                  top: `${50 + Math.sin(radians) * 31}%`
                }}
              >
                <Icon className="h-7 w-7 shrink-0 text-[#adfff3]/75 drop-shadow-[0_0_8px_rgba(108,255,235,0.55)] sm:h-10 sm:w-10" strokeWidth={1.7} />
                <span className="block max-w-full text-[9px] font-black uppercase leading-[1.05] tracking-[0.08em] text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)] sm:text-[13px] md:text-[15px]">
                  {option.label}
                </span>
              </div>
            );
          })}

          {segments.pool.map((option, index) => (
            <div
              key={`${option.id}-divider`}
              className="absolute left-1/2 top-0 h-1/2 w-px origin-bottom bg-[#d7fff9]/45"
              style={{ transform: `rotate(${index * segments.segmentSize}deg)` }}
            />
          ))}

          <div className="absolute inset-[33%] rounded-full border-[9px] border-[#66f2e5] bg-[#071827]/92 shadow-[0_0_28px_rgba(91,255,236,0.75),inset_0_0_28px_rgba(0,0,0,0.84)]" />
          <div className="absolute inset-[41%] rounded-full border border-[#adfff3]/60 bg-[radial-gradient(circle,#2ee6d2,#0b8077_58%,#052931)] shadow-[0_0_22px_rgba(94,255,235,0.92)]" />
        </div>

        <div className="absolute inset-[43%] z-30 rounded-full border border-[#e8fffb]/80 bg-[#35d7c8] shadow-[0_0_24px_rgba(94,255,235,0.95)]">
          <div className="absolute inset-[24%] grid grid-cols-2 gap-1">
            <span className="rounded-tl-full bg-[#071827]/65" />
            <span className="rounded-tr-full bg-[#071827]/65" />
            <span className="rounded-bl-full bg-[#071827]/65" />
            <span className="rounded-br-full bg-[#071827]/65" />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div id="roulette-page" className="space-y-6 max-w-6xl mx-auto animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-cyan-900/20 dark:border-cyan-500/15 pb-5">
        <div>
          <span className="inline-flex items-center gap-2 px-3 py-1 text-[10px] uppercase font-mono font-extrabold tracking-wider bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20 rounded-full">
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
          <Trophy className="h-4 w-4 text-cyan-500" />
          <span>{activeOptions.length} opcoes ativas</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section
          ref={wheelRef}
          className="xl:col-span-2 rounded-[34px] border border-[#a4fff2]/35 p-5 md:p-8 shadow-[0_24px_80px_rgba(4,47,64,0.35)] text-white overflow-hidden relative bg-[radial-gradient(circle_at_50%_20%,rgba(15,154,137,0.48),rgba(3,30,43,0.98)_48%,#061120_82%)]"
        >
          <div className="absolute inset-0 rounded-[34px] border border-white/10" />
          <div className="absolute inset-0 opacity-80 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,188,0.28),transparent_27%),radial-gradient(circle_at_78%_22%,rgba(125,249,236,0.16),transparent_24%)]" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-cyan-500/15 to-transparent" />

          <div className="relative z-10 space-y-7 text-center">
            <div className="space-y-3">
              <div className="mx-auto flex items-center justify-center gap-3 text-[#89fff0]">
                <div className="grid h-12 w-12 grid-cols-2 gap-1">
                  <span className="rounded-tl-full bg-current shadow-[0_0_16px_rgba(137,255,240,0.65)]" />
                  <span className="rounded-tr-full bg-current shadow-[0_0_16px_rgba(137,255,240,0.65)]" />
                  <span className="rounded-bl-full bg-current shadow-[0_0_16px_rgba(137,255,240,0.65)]" />
                  <span className="rounded-br-full bg-current shadow-[0_0_16px_rgba(137,255,240,0.65)]" />
                </div>
                <div className="text-left leading-none">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em]">Hotel</p>
                  <p className="text-4xl font-black tracking-tight">vilageinn</p>
                  <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">All Inclusive Pocos de Caldas</p>
                </div>
              </div>
              <h3 className="font-sans text-4xl font-black tracking-tight text-white drop-shadow-[0_0_14px_rgba(137,255,240,0.55)] md:text-5xl">
                Roda da Sorte
              </h3>
            </div>

            <Wheel />

            <button
              type="button"
              onClick={spin}
              disabled={spinning || !canSpin}
              className="mx-auto h-14 min-w-56 rounded-full border-2 border-[#bafff5] bg-[linear-gradient(180deg,rgba(52,255,229,0.32),rgba(2,74,78,0.94))] px-10 text-white font-sans font-black text-xl tracking-wide shadow-[0_0_28px_rgba(67,255,232,0.68),inset_0_0_18px_rgba(255,255,255,0.16)] hover:scale-[1.02] hover:shadow-[0_0_38px_rgba(67,255,232,0.9),inset_0_0_18px_rgba(255,255,255,0.22)] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {spinning ? 'GIRANDO...' : canSpin ? 'JOGAR' : 'CONFIGURE'}
            </button>

            {winner && (
              <div className="mx-auto max-w-sm rounded-2xl border border-cyan-200/30 bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-100">Ultimo premio</p>
                <p className="text-lg font-extrabold text-white">{winner.label}</p>
              </div>
            )}
          </div>
        </section>

        <aside className="bg-white dark:bg-slate-900 border border-cyan-900/10 dark:border-cyan-500/15 rounded-3xl p-5 shadow-sm space-y-4">
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
                  className="h-4 w-4 accent-cyan-500"
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
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs outline-none focus:border-cyan-500 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={addOption}
                  className="h-9 w-9 rounded-xl bg-cyan-600 text-white flex items-center justify-center hover:bg-cyan-500 transition-colors"
                  aria-label="Adicionar opcao"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={saveOptions}
                disabled={saving}
                className="w-full h-11 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-sans font-black text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
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
          <div className="w-full max-w-2xl text-center space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-cyan-100">
              <Star className="h-4 w-4 fill-cyan-200" />
              Boa sorte
            </div>
            <Wheel compact />
            <p className="text-sm font-bold text-white/80">A roleta esta escolhendo o premio...</p>
          </div>
        </div>
      )}

      {showPrizeModal && winner && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-cyan-200/40 bg-[radial-gradient(circle_at_top,rgba(52,211,184,0.9),#07505a_42%,#061120)] p-7 text-center text-white shadow-[0_30px_90px_rgba(34,211,188,0.38)]">
            <button
              type="button"
              onClick={() => setShowPrizeModal(false)}
              className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white/80 hover:bg-white/20"
              aria-label="Fechar resultado"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-white/10" />
            <div className="absolute -right-12 bottom-4 h-36 w-36 rounded-full bg-cyan-200/10" />

            <div className="relative z-10 space-y-5">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white text-cyan-700 shadow-[0_0_28px_rgba(186,255,245,0.68)]">
                <PartyPopper className="h-10 w-10" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.35em] text-cyan-100">Resultado da roleta</p>
                <h3 className="mt-2 font-sans text-4xl font-black tracking-tight">PARABENS!</h3>
              </div>
              <div className="rounded-2xl border border-white/25 bg-white/15 p-5 backdrop-blur-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-cyan-100">Voce ganhou</p>
                <p className="mt-1 text-2xl font-black text-white">{winner.label}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPrizeModal(false)}
                className="h-12 w-full rounded-full bg-white text-cyan-800 font-sans font-black text-sm shadow-lg hover:bg-cyan-50 transition-colors"
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
