import React from 'react';
import { Hammer, Wrench, Sparkles, Shield, Clock } from 'lucide-react';

export default function BookingListView() {
  return (
    <div id="booking-list-under-construction" className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto">
      <div className="relative mb-6">
        {/* Animated background glow */}
        <div className="absolute inset-0 bg-amber-500/10 blur-2xl rounded-full animate-pulse" />
        <div className="relative h-20 w-20 bg-amber-500/10 text-amber-500 dark:text-amber-400 rounded-2xl flex items-center justify-center border border-amber-500/20 shadow-lg shadow-amber-500/5">
          <Hammer className="h-10 w-10 animate-bounce" />
        </div>
      </div>

      <h2 className="font-sans font-bold text-2xl text-slate-900 dark:text-slate-50 tracking-tight mb-2">
        Listagem Booking
      </h2>
      
      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
        Este módulo está em desenvolvimento. Estamos configurando uma alternativa estruturada para exibição e gerenciamento seguro das avaliações do <strong>Booking.com</strong> exclusivas de hóspedes que frequentaram o hotel.
      </p>

      <div className="w-full bg-slate-100 dark:bg-slate-900/60 rounded-2xl border border-slate-200/50 dark:border-slate-800/80 p-5 font-mono text-left space-y-3 mb-6">
        <div className="flex items-center space-x-2 text-xs">
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
          <span className="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">Fase Atual:</span>
          <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold px-2 py-0.5 rounded text-[10px] uppercase font-sans">Em Construção</span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed pl-4">
          Mapeando fluxo de captação de listagem para vincular hóspedes reais da recepção à aprovação direta de regras de pontuação interna.
        </p>
      </div>

      <div className="flex items-center space-x-2 text-xs text-slate-400 dark:text-slate-500">
        <Sparkles className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
        <span>Novidades chegando na central Guardiões</span>
      </div>
    </div>
  );
}
