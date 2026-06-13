import { Calendar, Award, Sparkles, FolderKanban } from 'lucide-react';
import { MonthlyPrize, Sector } from '../types';

interface MonthlyPrizeCardProps {
  prize: MonthlyPrize | null;
  sectors: Sector[];
}

export default function MonthlyPrizeCard({ prize, sectors }: MonthlyPrizeCardProps) {
  const getSectorName = (id: string | null) => {
    if (!id) return null;
    return sectors.find(s => s.id === id)?.name || null;
  };

  const getReadableMonth = (monthISO: string) => {
    if (!monthISO) return '';
    const [year, month] = monthISO.split('-');
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const mIdx = parseInt(month, 10) - 1;
    return `${monthNames[mIdx] || month} de ${year}`;
  };

  // Safe image path fallback (replaced anime drawer with professional hotel lobby)
  const imageSrc = prize?.image_path || 
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80';

  return (
    <div className="bg-slate-900 text-white rounded-2xl overflow-hidden border border-slate-800 shadow-xl flex flex-col lg:flex-row animate-fade-in">
      {/* Visual illustration / Image */}
      <div className="lg:w-1/3 h-48 lg:h-auto min-h-[160px] relative shrink-0">
        <img 
          src={imageSrc} 
          alt="Prêmio do mës" 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-slate-950/70 via-slate-900/10 to-transparent" />
        <div className="absolute top-4 left-4 bg-amber-500/90 text-slate-950 px-3 py-1 rounded-full text-[10px] font-bold font-mono uppercase flex items-center space-x-1 tracking-wider shadow-md">
          <Sparkles className="h-3. w-3" />
          <span>Prêmio Ativo</span>
        </div>
      </div>

      {/* Main card copy details */}
      <div className="p-6 flex flex-col justify-between flex-1">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2 text-xs text-amber-400 font-medium font-mono">
            <span className="flex items-center space-x-1.5 bg-slate-800 px-2.5 py-1 rounded-lg">
              <Calendar className="h-3.5 w-3.5 text-amber-400" />
              <span>{prize ? getReadableMonth(prize.reference_month) : 'Este Mês'}</span>
            </span>
            
            {prize?.sector_id ? (
              <span className="flex items-center space-x-1 bg-amber-500/15 text-amber-300 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                <FolderKanban className="h-3.5 w-3.5" />
                <span>Setor: {getSectorName(prize.sector_id)}</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1 bg-cyan-500/15 text-cyan-300 border border-cyan-500/20 px-2.5 py-1 rounded-lg">
                <Award className="h-3.5 w-3.5" />
                <span>Prêmio Geral do Hotel</span>
              </span>
            )}
          </div>

          <h3 className="font-sans font-extrabold text-lg md:text-xl text-amber-50 mr-2 tracking-wide leading-tight mt-1">
            {prize?.title || 'Campanha de Hospitalidade do Mês'}
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed mt-2.5 font-light">
            {prize?.description || 'O guardião que registrar o maior engajamento e as melhores avaliações confirmadas neste mês com hóspedes do hotel receberá uma recompensa exclusiva. Contate sua governia/gerência de recepção.'}
          </p>
        </div>

        {/* Dynamic target incentive summary */}
        <div className="mt-5 border-t border-slate-800 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-[11px] text-slate-400">
              {prize?.footer_text_left || 'Pontuação computada até o final do dia.'}
            </p>
          </div>
          <p className="text-xs font-mono text-amber-400 font-semibold uppercase tracking-wider">
            {prize?.footer_text_right || 'Cada Conversão = +10 pontos'}
          </p>
        </div>
      </div>
    </div>
  );
}
