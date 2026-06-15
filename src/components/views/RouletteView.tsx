import React, { useEffect, useMemo, useState } from 'react';
import {
  Gift, Plus, RefreshCw, Save, Sparkles, Trash2, Trophy, Wand2
} from 'lucide-react';
import { ApiService, DEFAULT_ROULETTE_OPTIONS } from '../../lib/api';
import { Profile, RouletteOption } from '../../types';

interface RouletteViewProps {
  user: Profile;
}

const makeOptionId = () => `roulette-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export default function RouletteView({ user }: RouletteViewProps) {
  const isAdmin = user.role === 'admin';
  const [options, setOptions] = useState<RouletteOption[]>(DEFAULT_ROULETTE_OPTIONS);
  const [draftLabel, setDraftLabel] = useState('');
  const [winner, setWinner] = useState<RouletteOption | null>(null);
  const [reels, setReels] = useState<string[]>(['Late check out', 'Espumante', 'Nada']);
  const [spinning, setSpinning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    ApiService.getRouletteOptions().then((loadedOptions) => {
      if (!mounted) return;
      setOptions(loadedOptions);
      const activeLabels = loadedOptions.filter(option => option.active).map(option => option.label);
      if (activeLabels.length >= 3) {
        setReels(activeLabels.slice(0, 3));
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const activeOptions = useMemo(() => {
    return options.filter(option => option.active && option.label.trim());
  }, [options]);

  const pickRandomOption = () => {
    const pool = activeOptions.length > 0 ? activeOptions : DEFAULT_ROULETTE_OPTIONS;
    return pool[Math.floor(Math.random() * pool.length)];
  };

  const spin = () => {
    if (spinning || activeOptions.length < 2) return;

    setWinner(null);
    setMessage(null);
    setSpinning(true);

    const startedAt = Date.now();
    const duration = 2600;
    const timer = window.setInterval(() => {
      setReels([pickRandomOption().label, pickRandomOption().label, pickRandomOption().label]);
      if (Date.now() - startedAt >= duration) {
        window.clearInterval(timer);
        const finalWinner = pickRandomOption();
        setWinner(finalWinner);
        setReels([finalWinner.label, finalWinner.label, finalWinner.label]);
        setSpinning(false);
      }
    }, 90);
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

  return (
    <div id="roulette-page" className="space-y-6 max-w-6xl mx-auto animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-150 dark:border-slate-800 pb-5">
        <div>
          <span className="inline-flex items-center gap-2 px-3 py-1 text-[10px] uppercase font-mono font-extrabold tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-full">
            <Sparkles className="h-3.5 w-3.5" />
            Campanha de recompensas
          </span>
          <h2 className="font-sans font-extrabold text-2xl md:text-3xl text-slate-800 dark:text-slate-100 tracking-tight mt-3">
            Roleta dos Guardioes
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-2xl">
            Sorteio rapido de brindes e experiencias para manter a campanha viva durante o atendimento.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Trophy className="h-4 w-4 text-amber-500" />
          <span>{activeOptions.length} opcoes ativas</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 bg-slate-950 border border-slate-800 rounded-3xl p-5 md:p-8 shadow-xl text-white overflow-hidden relative">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 via-emerald-400 to-sky-400" />
          <div className="relative z-10 space-y-7">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-sans font-black text-lg text-amber-50">Caca-niquel de premios</h3>
                <p className="text-[11px] text-slate-400 mt-1">Tres rolos, uma recompensa, visual de campanha.</p>
              </div>
              {winner && (
                <div className="px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-right">
                  <p className="text-[10px] uppercase tracking-wider font-mono text-amber-300">Resultado</p>
                  <p className="text-sm font-extrabold text-amber-50">{winner.label}</p>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-700 bg-slate-900 p-4 md:p-6 shadow-inner">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {reels.map((label, index) => (
                  <div
                    key={`${label}-${index}`}
                    className={`h-32 md:h-40 rounded-2xl border flex items-center justify-center px-4 text-center transition-all duration-150 overflow-hidden
                      ${spinning
                        ? 'border-amber-500/40 bg-slate-800 shadow-lg shadow-amber-500/10'
                        : 'border-slate-700 bg-slate-950'}`}
                  >
                    <span className={`font-sans font-black text-lg md:text-xl leading-tight text-balance ${spinning ? 'text-amber-300 blur-[0.5px]' : 'text-slate-50'}`}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={spin}
                disabled={spinning || activeOptions.length < 2}
                className="flex-1 h-12 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-sans font-black text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-amber-500/10"
              >
                {spinning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                <span>{spinning ? 'Girando...' : 'Girar roleta'}</span>
              </button>
            </div>

            {winner && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-start gap-3">
                <Gift className="h-5 w-5 text-emerald-300 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-emerald-300">Premio sorteado</p>
                  <p className="text-base font-extrabold text-emerald-50">{winner.label}</p>
                </div>
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
                  className="h-4 w-4 accent-amber-500"
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
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs outline-none focus:border-amber-500 dark:text-slate-100"
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
                className="w-full h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-sans font-black text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
              >
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span>{saving ? 'Salvando...' : 'Salvar opcoes'}</span>
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
