import React, { useState, useEffect } from 'react';
import { Star, ChevronRight, CheckCircle, AlertCircle, Info, ShieldCheck } from 'lucide-react';
import { ApiService } from '../../lib/api';
import RatingStars from '../RatingStars';
import AppLogo from '../AppLogo';

interface PublicFormsViewProps {
  token: string;
  isInternalFormExplicit?: boolean; // True if page path is specifically /avaliacao-interna/:token
}

export default function PublicFormsView({ token, isInternalFormExplicit = false }: PublicFormsViewProps) {
  
  const [viewState, setViewState] = useState<'loading' | 'redirection' | 'internal_form' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('Processando sua conexão com o hotel...');
  const [platformName, setPlatformName] = useState('Portal do Hotel');

  // Internal NPS Feedback Form fields
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [guestName, setGuestName] = useState('');
  const [suiteNum, setSuiteNum] = useState('');
  const [lgpdConsent, setLgpdConsent] = useState(true);

  const [formSubmitting, setFormSubmitting] = useState(false);

  // Auto trigger tracking and redirect routing
  useEffect(() => {
    const handleInitialRoute = async () => {
      try {
        if (isInternalFormExplicit) {
          setViewState('internal_form');
          return;
        }

        // Call redirection tracker
        const res = await ApiService.trackRedirect(token);
        
        if (res.error) {
          setErrorMessage(res.error);
          setViewState('error');
          return;
        }

        if (!res.url) {
          throw new Error('Nenhuma rota final configurada para este convite.');
        }

        const isInternal = res.url.includes('avaliacao-interna');

        if (isInternal) {
          // It's internal NPS platform code target! Show the feedback form in place
          setViewState('internal_form');
        } else {
          // External target (Google, Booking, Tripadvisor). Show elegant redirection status
          let deducedPlatform = 'Plataforma Oficial';
          const urlLower = res.url.toLowerCase();
          if (urlLower.includes('google')) {
            deducedPlatform = 'Google Reviews';
          } else if (urlLower.includes('booking')) {
            deducedPlatform = 'Booking.com';
          } else if (urlLower.includes('tripadvisor')) {
            deducedPlatform = 'TripAdvisor';
          } else if (urlLower.includes('myhotel') || urlLower.includes('my-hotel')) {
            deducedPlatform = 'MyHotel';
          }

          setPlatformName(deducedPlatform);
          setViewState('redirection');
          
          // Keep the branded bridge brief: tracking is already done at this point.
          setTimeout(() => {
            window.location.replace(res.url);
          }, 350);
        }

      } catch (err: any) {
        setErrorMessage(err.message || 'Falha ao autenticar token de avaliação. Informe à recepção.');
        setViewState('error');
      }
    };

    handleInitialRoute();
  }, [token, isInternalFormExplicit]);

  const handleNpsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lgpdConsent) {
      alert('Por favor, confirme a autorização de privacidade (LGPD).');
      return;
    }

    setFormSubmitting(true);
    try {
      const res = await ApiService.submitInternalReview(token, {
        score: rating,
        comment: comment.trim(),
        guest_name: guestName.trim() || undefined,
        room_number: suiteNum.trim() || undefined,
        consent_given: lgpdConsent
      });

      if (res.error) {
        alert(res.error);
      } else {
        setViewState('success');
      }
    } catch (err: any) {
      alert(err.message || 'Falha ao processar envio do NPS.');
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div id="public-guest-layout" className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      {/* Absolute luxury aesthetic gold dots */}
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#f59e0b_1.5px,transparent_1px)] [background-size:24px_24px]" />
      
      <div id="public-guest-card" className="w-full max-w-md bg-slate-950 border border-slate-800 text-white rounded-3xl overflow-hidden shadow-2xl relative z-10 p-8 flex flex-col items-center">
        
        {/* Elegant Header */}
        <div className="text-center mb-6">
          <div className="mx-auto flex justify-center mb-3 animate-fade-in">
            <AppLogo size={102} whiteText={true} />
          </div>
          <h1 className="font-sans font-extrabold text-xl text-amber-50 tracking-wide leading-tight">
            Guardiões do atendimento
          </h1>
          <p className="text-[10px] text-slate-400 font-sans tracking-widest uppercase mt-1">
            Sua Opinião Importa
          </p>
        </div>

        {/* LOADING STATE VIEW */}
        {viewState === 'loading' && (
          <div id="view-loading-redirect" className="text-center py-10 space-y-4 animate-fade-in w-full">
            <div className="relative mx-auto h-12 w-12 flex items-center justify-center">
              <div className="absolute inset-x-0 inset-y-0 border-2 border-slate-800 border-t-amber-500 rounded-full animate-spin" />
            </div>
            
            <div className="space-y-1 pt-2">
              <p className="font-semibold text-slate-200 text-sm">Verificando Convite Seguro...</p>
              <p className="text-[11px] text-slate-450 leading-relaxed max-w-[260px] mx-auto">
                Aguarde alguns segundos enquanto conectamos seu dispositivo à plataforma de fidelidade.
              </p>
            </div>
          </div>
        )}

        {/* REDIRECTION STATE VIEW */}
        {viewState === 'redirection' && (
          <div id="view-redirect-countdown" className="text-center py-8 space-y-5 animate-fade-in w-full">
            <div className="w-14 h-14 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto text-sm animate-pulse">
              ★ ★ ★
            </div>

            <div className="space-y-2">
              <h2 className="font-sans font-bold text-base text-slate-100">Pronto! Redirecionando...</h2>
              <p className="text-xs text-slate-400 px-2 leading-relaxed">
                Você será levado de forma automatizada ao canal oficial do <strong className="text-amber-400">{platformName}</strong> para postar sua recomendação.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-lg text-[10px] text-slate-400 font-mono">
              Processando redirecionamento...
            </div>
          </div>
        )}

        {/* NPS INTERNAL FORM STATE VIEW (LGPD-COMPLIANT) */}
        {viewState === 'internal_form' && (
          <form onSubmit={handleNpsSubmit} id="form-nps-feedback" className="w-full space-y-5 animate-fade-in">
            <div className="text-center space-y-1 border-b border-slate-800/80 pb-3">
              <h3 className="font-sans font-bold text-sm text-amber-100">Pesquisa Geral de Satisfação</h3>
              <p className="text-[11px] text-slate-400">Suas percepções são tratadas de forma confidencial com o gerente geral.</p>
            </div>

            {/* Stars Selector component */}
            <div className="space-y-1 text-center">
              <label className="block text-[10px] font-bold text-amber-400 uppercase tracking-widest">
                Qual nota daria à sua estadia?
              </label>
              <RatingStars 
                rating={rating} 
                interactive={true} 
                onChange={setRating} 
                size={8}
              />
              <span className="text-[11px] text-slate-500 font-bold tracking-wide uppercase">
                {rating === 5 ? 'Excelente' : rating === 4 ? 'Muito Bom' : rating === 3 ? 'Suficiente' : rating === 2 ? 'Inadequado' : 'Crítico'}
              </span>
            </div>

            {/* Comment textbox */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase">Seu Relato / Sugestão</label>
              <textarea
                required
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Conte-nos o que tornou sua experiência única ou o que precisamos aprimorar..."
                className="w-full text-xs p-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-amber-500 bg-slate-900 text-slate-50 outline-none leading-relaxed"
              />
            </div>

            {/* Guest Identification Fields */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-slate-400 uppercase">Seu Nome (Opcional)</label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Ex: Carlos"
                  className="w-full text-xs p-2 rounded-lg border border-slate-800 bg-slate-900 text-slate-100 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-slate-400 uppercase">Número do Quarto</label>
                <input
                  type="text"
                  value={suiteNum}
                  onChange={(e) => setSuiteNum(e.target.value)}
                  placeholder="Ex: 502"
                  className="w-full text-xs p-2 rounded-lg border border-slate-800 bg-slate-900 text-slate-100 outline-none"
                />
              </div>
            </div>

            {/* LGPD Consent */}
            <div className="flex items-start space-x-2.5 p-3 bg-slate-900/60 border border-slate-850 rounded-xl">
              <input
                type="checkbox"
                required
                checked={lgpdConsent}
                onChange={(e) => setLgpdConsent(e.target.checked)}
                className="rounded border-slate-700 text-amber-500 mt-0.5"
                id="checkbox-lgpd-guest"
              />
              <label htmlFor="checkbox-lgpd-guest" className="text-[10px] text-slate-400 leading-tight select-none font-sans">
                Autorizo a coleta e o processamento confidencial destas respostas para fins exclusivos de controle da qualidade interna do Guardiões do atendimento.
              </label>
            </div>

            <button
              type="submit"
              disabled={formSubmitting}
              id="btn-submit-nps-form"
              className="w-full h-10 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold rounded-xl flex items-center justify-center space-x-1 transition-all mt-4.5"
            >
              <span>{formSubmitting ? 'Enviando Relato...' : 'Enviar Avaliação'}</span>
            </button>
          </form>
        )}

        {/* SUCCESS STATE VIEW */}
        {viewState === 'success' && (
          <div id="view-nps-success" className="text-center py-8 space-y-4 animate-fade-in w-full">
            <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-xl">
              <ShieldCheck className="h-8 w-8 text-emerald-500" />
            </div>

            <div className="space-y-2">
              <h2 className="font-sans font-bold text-lg text-emerald-400">Muito Obrigado!</h2>
              <p className="text-xs text-slate-400 px-4 leading-relaxed font-light">
                Suas respostas foram gravadas de forma segura e já estão disponíveis no painel de auditoria do hotel. Sua opinião nos ajuda a aprimorar nosso compromisso de hospitalidade todos os dias.
              </p>
            </div>

            <div className="bg-slate-900 p-2 text-[9px] text-slate-500 rounded-lg font-mono">
              Comunicação criptografada (SSL) — LGPD OK
            </div>
          </div>
        )}

        {/* ERROR STATE VIEW */}
        {viewState === 'error' && (
          <div id="view-nps-error" className="text-center py-8 space-y-4 animate-fade-in w-full">
            <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto text-xl">
              <AlertCircle className="h-6 w-6 text-red-600 shrink-0" />
            </div>

            <div className="space-y-2">
              <h2 className="font-sans font-bold text-base text-red-400">Erro de Validação</h2>
              <p className="text-xs text-slate-400 px-4 font-mono">
                {errorMessage}
              </p>
            </div>

            <p className="text-[10px] text-slate-500 leading-normal max-w-xs mx-auto">
              Se este erro persistir, peça à recepção para emitir um novo link rastreável pelo WhatsApp ou reescanear o QR Code ativo.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
