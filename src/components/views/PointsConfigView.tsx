import React, { useState, useEffect } from 'react';
import { 
  Sliders, Check, AlertCircle, Sparkles, RefreshCw, Key, 
  HelpCircle, ChevronRight, Calculator, Landmark, ShieldCheck, 
  Info, Award, Settings2
} from 'lucide-react';
import { ApiService } from '../../lib/api';
import { motion } from 'motion/react';

interface PointsConfigViewProps {
  weights: Record<string, number>;
  onRefresh: () => void;
}

export default function PointsConfigView({ weights, onRefresh }: PointsConfigViewProps) {
  // Local state for weights to support immediate user input feedback
  const [internalCompleted, setInternalCompleted] = useState(1);
  const [externalConfirmed, setExternalConfirmed] = useState(10);
  const [externalReconciled, setExternalReconciled] = useState(10);
  const [qrGenerated, setQrGenerated] = useState(0);
  const [whatsappGenerated, setWhatsappGenerated] = useState(0);
  const [linkOpened, setLinkOpened] = useState(0);

  // Platform-specific campaign points
  const [platBooking, setPlatBooking] = useState(5);
  const [platTripadvisor, setPlatTripadvisor] = useState(3);
  const [platGoogle, setPlatGoogle] = useState(2);
  const [platInternal, setPlatInternal] = useState(1);

  // Status and response handling
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'weights' | 'explainer'>('weights');

  // Synchronize local state with globally loaded database weights
  useEffect(() => {
    if (weights) {
      if (weights.internal_review_completed !== undefined) setInternalCompleted(weights.internal_review_completed);
      if (weights.external_review_confirmed !== undefined) setExternalConfirmed(weights.external_review_confirmed);
      if (weights.external_review_reconciled !== undefined) setExternalReconciled(weights.external_review_reconciled);
      if (weights.qr_generated !== undefined) setQrGenerated(weights.qr_generated);
      if (weights.whatsapp_generated !== undefined) setWhatsappGenerated(weights.whatsapp_generated);
      if (weights.link_opened !== undefined) setLinkOpened(weights.link_opened);
      
      if (weights.platform_booking !== undefined) setPlatBooking(weights.platform_booking);
      if (weights.platform_tripadvisor !== undefined) setPlatTripadvisor(weights.platform_tripadvisor);
      if (weights.platform_google !== undefined) setPlatGoogle(weights.platform_google);
      if (weights.platform_internal !== undefined) setPlatInternal(weights.platform_internal);
    }
  }, [weights]);

  // Handle saving weight changes back to API / Database
  const handleSaveWeights = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Save all updated weights asynchronously in parallel
      await Promise.all([
        ApiService.updateWeight('internal_review_completed', internalCompleted),
        ApiService.updateWeight('external_review_confirmed', externalConfirmed),
        ApiService.updateWeight('external_review_reconciled', externalReconciled),
        ApiService.updateWeight('qr_generated', qrGenerated),
        ApiService.updateWeight('whatsapp_generated', whatsappGenerated),
        ApiService.updateWeight('link_opened', linkOpened),
        ApiService.updateWeight('platform_booking', platBooking),
        ApiService.updateWeight('platform_tripadvisor', platTripadvisor),
        ApiService.updateWeight('platform_google', platGoogle),
        ApiService.updateWeight('platform_internal', platInternal)
      ]);

      setSuccess('Parâmetros do sistema de pontuação atualizados com sucesso!');
      onRefresh(); // Trigger dynamic refresh to propagate update immediately
      
      // Auto fade-out banner after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao salvar novas regras de pontuação.');
    } finally {
      setLoading(false);
    }
  };

  // Restore Default Values Handler
  const handleRestoreDefaults = () => {
    setInternalCompleted(1);
    setExternalConfirmed(10);
    setExternalReconciled(10);
    setQrGenerated(0);
    setWhatsappGenerated(0);
    setLinkOpened(0);
    setPlatBooking(5);
    setPlatTripadvisor(3);
    setPlatGoogle(2);
    setPlatInternal(1);
    setSuccess('Valores redefinidos para os padrões da Campanha Guardiões! Clique em salvar para confirmar.');
  };

  // Interactive points simulation outputs
  const simInvites = 15;
  const simTripadvisor = 4;
  const simGoogle = 6;
  const simMyHotel = 8;
  
  const calculatedPoints = 
    (simInvites * qrGenerated) + 
    (simTripadvisor * platTripadvisor) + 
    (simGoogle * platGoogle) + 
    (simMyHotel * platInternal);

  return (
    <div id="points-config-container" className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-150 dark:border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 text-[10px] uppercase font-mono font-extrabold tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full">
              Engine de Gamificação
            </span>
            <div className="flex items-center space-x-1 text-slate-400">
              <span className="text-xs font-mono">•</span>
              <span className="text-xs font-semibold">Regras & Pesos</span>
            </div>
          </div>
          <h2 className="font-sans font-extrabold text-2xl md:text-3xl text-slate-800 dark:text-slate-100 tracking-tight mt-1 flex items-center gap-2">
            Regras de Pontuação & Token 🔑
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-2xl">
            Ajuste a pontuação recebida pelos Guardiões para cada etapa de conversão alcançada. Entenda de forma interativa como o sistema de tokens funciona para o seu robô Python.
          </p>
        </div>

        {/* View mode buttons */}
        <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200/50 dark:border-slate-800">
          <button
            id="tab-btn-weights"
            onClick={() => setActiveTab('weights')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'weights' 
                ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm' 
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <div className="flex items-center space-x-1.5">
              <Sliders className="h-3.5 w-3.5" />
              <span>Ajustar Pesos</span>
            </div>
          </button>
          <button
            id="tab-btn-explainer"
            onClick={() => setActiveTab('explainer')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'explainer' 
                ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm' 
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <div className="flex items-center space-x-1.5">
              <Key className="h-3.5 w-3.5" />
              <span>O que é o Token?</span>
            </div>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div id="points-error-banner" className="p-4 bg-red-50/80 dark:bg-red-950/20 border border-red-100 dark:border-red-900 text-red-800 dark:text-red-200 rounded-2xl text-xs flex items-center space-x-3 shadow-sm animate-fade-in">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div id="points-success-banner" className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 text-emerald-800 dark:text-emerald-250 rounded-2xl text-xs flex items-center space-x-3 shadow-sm animate-fade-in">
          <Check className="h-5 w-5 text-emerald-500 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {activeTab === 'weights' && (
        <div id="view-weights-config" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT & CENTER PANEL: WEIGHT FORMS */}
          <form onSubmit={handleSaveWeights} className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-amber-500/10 rounded-lg">
                    <Settings2 className="h-4.5 w-4.5 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="font-sans font-bold text-base text-slate-800 dark:text-slate-100">Configuração de Pontuações Ativas</h3>
                    <p className="text-[11px] text-slate-400">Defina o retorno em pontos para cada engajamento do hóspede com as pesquisas.</p>
                  </div>
                </div>
                
                <button
                  id="btn-restore-defaults"
                  type="button"
                  onClick={handleRestoreDefaults}
                  className="px-3 py-1.5 text-[11px] font-bold text-amber-600 bg-amber-500/5 hover:bg-amber-500/10 rounded-lg transition-colors border border-amber-500/10 hover:border-amber-500/20 cursor-pointer"
                >
                  Restaurar Recomendados
                </button>
              </div>

              {/* Grid with 2 columns to make it look highly professional */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Rule block: TRIPADVISOR */}
                <div className="p-5 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/60 rounded-2xl space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="px-2 py-0.5 text-[9px] bg-[#00AA6C]/10 text-[#00AA6C] dark:text-emerald-450 font-mono font-bold rounded-md">
                        CAMPANHA: 3 PONTOS
                      </span>
                      <h4 className="font-sans font-bold text-xs text-slate-800 dark:text-slate-100 mt-1">Tripadvisor</h4>
                    </div>
                    <span className="text-sm font-mono font-extrabold text-[#00AA6C]">+{platTripadvisor} pts</span>
                  </div>
                  <p className="text-[10px] text-slate-400">Avaliação detalhada com título e texto no Tripadvisor. Peso sugerido: 3 pontos.</p>
                  
                  <div id="slider-tripadvisor-group" className="space-y-1.5 pt-2">
                    <input 
                      type="range" 
                      min="0" 
                      max="15" 
                      value={platTripadvisor} 
                      onChange={(e) => setPlatTripadvisor(parseInt(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 font-semibold font-mono">
                      <span>0 pt</span>
                      <span>3 pt</span>
                      <span>15 pt</span>
                    </div>
                  </div>
                </div>

                {/* Rule block: GOOGLE */}
                <div className="p-5 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/60 rounded-2xl space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="px-2 py-0.5 text-[9px] bg-[#4285F4]/10 text-[#4285F4] dark:text-blue-300 font-mono font-bold rounded-md">
                        CAMPANHA: 2 PONTOS
                      </span>
                      <h4 className="font-sans font-bold text-xs text-slate-800 dark:text-slate-100 mt-1">Google Reviews</h4>
                    </div>
                    <span className="text-sm font-mono font-extrabold text-[#4285F4] dark:text-blue-300">+{platGoogle} pts</span>
                  </div>
                  <p className="text-[10px] text-slate-400">Avaliação rápida via conta Gmail. Peso sugerido: 2 pontos.</p>
                  
                  <div id="slider-google-group" className="space-y-1.5 pt-2">
                    <input 
                      type="range" 
                      min="0" 
                      max="15" 
                      value={platGoogle} 
                      onChange={(e) => setPlatGoogle(parseInt(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 font-semibold font-mono">
                      <span>0 pt</span>
                      <span>2 pt</span>
                      <span>15 pt</span>
                    </div>
                  </div>
                </div>

                {/* Rule block: MYHOTEL */}
                <div className="p-5 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/60 rounded-2xl space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="px-2 py-0.5 text-[9px] bg-[#1198db]/10 text-[#1198db] font-mono font-bold rounded-md">
                        CAMPANHA: 1 PONTO
                      </span>
                      <h4 className="font-sans font-bold text-xs text-slate-800 dark:text-slate-100 mt-1">MyHotel NPS</h4>
                    </div>
                    <span className="text-sm font-mono font-extrabold text-[#1198db]">+{platInternal} pts</span>
                  </div>
                  <p className="text-[10px] text-slate-400">Pesquisa interna de satisfação no MyHotel. Peso sugerido: 1 ponto.</p>
                  
                  <div id="slider-myhotel-group" className="space-y-1.5 pt-2">
                    <input 
                      type="range" 
                      min="0" 
                      max="10" 
                      value={platInternal} 
                      onChange={(e) => setPlatInternal(parseInt(e.target.value))}
                      className="w-full accent-sky-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 font-semibold font-mono">
                      <span>0 pt</span>
                      <span>1 pt</span>
                      <span>10 pt</span>
                    </div>
                  </div>
                </div>

                {/* Rule block: Micro actions: QR code generator */}
                <div className="p-5 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-150 dark:border-slate-800/60 rounded-2xl space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="px-2 py-0.5 text-[9px] bg-purple-500/10 text-purple-600 dark:text-purple-400 font-mono font-bold rounded-md">
                        MICROTROFÉU: Emissão QR
                      </span>
                      <h4 className="font-sans font-bold text-xs text-slate-800 dark:text-slate-100 mt-1">QR Code Gerado na hora</h4>
                    </div>
                    <span className="text-sm font-mono font-extrabold text-purple-600 dark:text-purple-450">+{qrGenerated} pts</span>
                  </div>
                  <p className="text-[10px] text-slate-400">Considere atribuir pontuação residual por apenas gerar o QR code no guichê (bom para engajamento passivo).</p>
                  
                  <div id="slider-qr-group" className="space-y-1.5 pt-2">
                    <input 
                      type="range" 
                      min="0" 
                      max="10" 
                      value={qrGenerated} 
                      onChange={(e) => setQrGenerated(parseInt(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 font-semibold font-mono">
                      <span>0 pt</span>
                      <span>5 pt</span>
                      <span>10 pt</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Secondary Micro weight sliders in subgrid */}
              <div className="border-t border-slate-100 dark:border-slate-800/80 pt-6">
                <h4 className="font-sans font-bold text-xs text-slate-400 uppercase tracking-wider mb-4">Parâmetros Adicionais de Geração</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
                      <span>Envio automático de WhatsApp</span>
                      <span className="font-mono text-amber-500">+{whatsappGenerated} pts</span>
                    </div>
                    <input 
                      type="range" min="0" max="10" value={whatsappGenerated} 
                      onChange={(e) => setWhatsappGenerated(parseInt(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer text-xs" 
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
                      <span>Abertura direta do link de redirecionamento</span>
                      <span className="font-mono text-amber-500">+{linkOpened} pts</span>
                    </div>
                    <input 
                      type="range" min="0" max="10" value={linkOpened} 
                      onChange={(e) => setLinkOpened(parseInt(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer text-xs" 
                    />
                  </div>
                </div>
              </div>

              <div id="weights-footer-section" className="flex items-center justify-end space-x-3 border-t border-slate-100 dark:border-slate-800 pt-5">
                <button
                  id="btn-save-weights"
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-slate-900 border border-slate-800 hover:bg-slate-800 dark:bg-amber-500 dark:hover:bg-amber-600 dark:text-slate-950 dark:border-none text-white font-sans font-bold text-xs rounded-xl transition-all shadow-sm flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>{loading ? 'Sincronizando Sistema...' : 'Salvar Alterações e Pesos'}</span>
                </button>
              </div>
            </div>
          </form>

          {/* RIGHT SIDEBAR: POINT SIMULATION & METRICS */}
          <div className="space-y-6">
            
            {/* Simulation Card */}
            <div className="bg-slate-900 text-slate-100 border border-slate-800 rounded-3xl p-6 shadow-md relative overflow-hidden">
              <div className="absolute -right-6 -bottom-6 text-slate-800 opacity-30 transform rotate-12">
                <Calculator className="h-32 w-32" />
              </div>
              
              <div className="relative z-10 space-y-4">
                <div className="flex items-center space-x-1.5 text-amber-400">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-[10px] tracking-wider uppercase font-extrabold font-mono">Simulador de engajamento</span>
                </div>
                
                <h3 className="font-sans font-extrabold text-lg text-amber-50">Impacto no Ranking Mensal</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Veja quanto um guardião receberá de pontuação em média caso faça os seguintes atendimentos no hotel com as regras configuradas:
                </p>

                <div className="space-y-2.5 border-t border-slate-800 pt-4">
                  {qrGenerated > 0 && (
                    <div className="flex justify-between text-xs text-slate-300">
                      <span>{simInvites} QR Codes emitidos:</span>
                      <span className="font-mono text-slate-400">+{simInvites * qrGenerated} pts</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>{simTripadvisor} avaliações Tripadvisor:</span>
                    <span className="font-mono text-slate-400">+{simTripadvisor * platTripadvisor} pts</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>{simGoogle} avaliações Google Reviews:</span>
                    <span className="font-mono text-slate-400">+{simGoogle * platGoogle} pts</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>{simMyHotel} avaliações MyHotel NPS:</span>
                    <span className="font-mono text-slate-400">+{simMyHotel * platInternal} pts</span>
                  </div>
                  
                  <div className="border-t border-slate-800 pt-3 flex justify-between text-sm font-sans font-extrabold text-amber-300">
                    <span>Total Simulado:</span>
                    <span className="text-base font-mono">{calculatedPoints} pontos</span>
                  </div>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/30 text-[10px] text-slate-400">
                  <strong className="text-amber-100 block mb-0.5">💡 Campanha Guardiões:</strong>
                  Estimule a equipe a coletar avaliações de alta pontuação como TripAdvisor ({platTripadvisor} pts) e Google Reviews ({platGoogle} pts) aplicando as regras de forma integrada.
                </div>
              </div>
            </div>

            {/* Token Intro-pitch widget (Clicking moves to Tab 2) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/85 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-100">
                <Key className="h-4.5 w-4.5 text-amber-500 shrink-0" />
                <h4 className="font-sans font-bold text-sm">Integrando com Python o My Hotel?</h4>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Você sabia que o código token inserido em cada link serve exclusivamente para o seu robô Python cruzar dados de forma automática sem precisar de API oficial?
              </p>
              <button
                id="btn-go-to-token-explainer"
                type="button"
                onClick={() => setActiveTab('explainer')}
                className="w-full py-2.5 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-xl text-xs font-bold text-slate-700 dark:text-amber-400 transition-colors border border-slate-150 dark:border-slate-800/80 cursor-pointer flex items-center justify-center space-x-1"
              >
                <span>Aprender como o Token funciona</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

        </div>
      )}

      {activeTab === 'explainer' && (
        <div id="view-token-explainer" className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
          <div className="flex items-center space-x-3 border-b border-slate-100 dark:border-slate-850 pb-3">
            <div className="p-2.5 bg-amber-500/10 rounded-xl">
              <Key className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <h3 className="font-sans font-extrabold text-base text-slate-800 dark:text-slate-100">Como funciona o Código Token de Convite?</h3>
              <p className="text-xs text-slate-500">Mapeamento preciso de hóspedes, atendimento e conciliação de reviews via automação Python.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Tech details explanation */}
            <div className="lg:col-span-2 space-y-6 text-slate-700 dark:text-slate-300">
              
              <div className="space-y-3">
                <h4 className="font-sans font-extrabold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  1. O que é o Token na prática?
                </h4>
                <p className="text-xs leading-relaxed pl-3.5">
                  Toda vez que um guardião indica ou gera um link (por exemplo, no checkout do hotel ou mesas de refeição), o sistema gera um identificador único de segurança como <strong><code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-amber-600 font-bold font-mono">tok-4G1K9B2</code></strong>. 
                  Este código é incorporado ao link final fornecido ao cliente (por ex: <code className="text-[11px] bg-slate-50 dark:bg-slate-805 px-1.5 py-0.5 border border-slate-100 dark:border-slate-800 rounded font-mono break-all text-slate-500">http://seuhotel.com/r/tok-4G1K9B2</code>).
                </p>
                <p className="text-xs leading-relaxed pl-3.5">
                  Isso evita links genéricos. Quando o hóspede clica, registra-se imediatamente no banco a abertura sob a custódia daquele colaborador emissor.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="font-sans font-extrabold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  2. Fluxo sugerido para o seu Script Robô Python (Integração My Hotel)
                </h4>
                <p className="text-xs leading-relaxed pl-3.5">
                  Como o hotel não possui acesso à API do My Hotel (que centraliza canais públicos e privados), o método do <strong>Robô Web Scraping</strong> em Python é excelente. Ele funciona idealmente seguindo este fluxo estruturado:
                </p>
                
                {/* Visual steps */}
                <div className="pl-3.5 space-y-4 pt-1">
                  <div className="flex items-start space-x-2.5">
                    <span className="font-mono text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md mt-0.5 shrink-0">Passo 1</span>
                    <p className="text-xs">
                      <strong>Raspagem de dados:</strong> O robô Python faz o login no sistema My Hotel via navegador simulado (por exemplo, usando <code>Selenium</code> ou <code>Playwright</code>) e lê a lista de avaliações postadas no dia ou na semana, guardando o <strong>Nome do Autor</strong> e a <strong>Data da avaliação</strong>.
                    </p>
                  </div>

                  <div className="flex items-start space-x-2.5">
                    <span className="font-mono text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md mt-0.5 shrink-0">Passo 2</span>
                    <p className="text-xs">
                      <strong>Carga da tabela local:</strong> Se o robô tiver acesso rápido ou banco sincronizado, ele lê a tabela do nosso sistema de convites (os <strong>ReviewInvites</strong> marcados como <code className="text-[10px] px-1 bg-yellow-500/10 text-yellow-600 rounded">opened</code> ou <code className="text-[10px] px-1 bg-sky-500/10 text-sky-600 rounded font-semibold text-xs">internal_completed</code>), onde temos o nome do hóspede informado no guichê (ex: <em>"Carlos Eduardo"</em>).
                    </p>
                  </div>

                  <div className="flex items-start space-x-2.5">
                    <span className="font-mono text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md mt-0.5 shrink-0">Passo 3</span>
                    <p className="text-xs">
                      <strong>Batimento de Nomes:</strong> O Python faz uma análise parcial de strings (fuzzy matching). Se achar um autor no My Hotel idêntico ou muito similar (ex: <em>"Carlos E."</em> ou <em>"Carlos Eduardo"</em>), o robô estabelece o batimento positivo.
                    </p>
                  </div>

                  <div className="flex items-start space-x-2.5">
                    <span className="font-mono text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md mt-0.5 shrink-0">Passo 4</span>
                    <p className="text-xs">
                      <strong>Confirmação via Script:</strong> O robô chama nossa função chamando o Endpoint de confirmação do nosso app usando as credenciais de Admin, efetuando o repasse de pontos automáticos ao Guardião.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-sans font-extrabold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  3. Lógica de repescagem ("Regra de 5 Dias")
                </h4>
                <p className="text-xs leading-relaxed pl-3.5">
                  Muitas vezes, o hóspede gera o convite no checkout, mas só escreve o review de fato alguns dias depois. Por isso, a sua automação em Python deve:
                </p>
                <div className="pl-3.5 bg-slate-50 dark:bg-slate-900/60 p-3.5 border border-slate-100 dark:border-slate-805/80 rounded-2xl text-xs space-y-2">
                  <p>
                    📌 <strong>Tentar novamente até expirar:</strong> Se o robô não achar o nome do devedor hoje, marque no script interno para retestar este convite em <strong>5 dias</strong>. Durante esse ciclo ele permanece sob análise passiva no app.
                  </p>
                  <p>
                    📌 Isso evita aprovações equivocadas precoces e garante que mesmo hóspedes atrasados concedam os preciosos pontos aos seus guardiões!
                  </p>
                </div>
              </div>

            </div>

            {/* Side tips and example python snippet */}
            <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800 shrink-0 space-y-4">
              <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-100">
                <Info className="h-4 w-4 text-amber-500" />
                <h4 className="font-sans font-bold text-xs">Snippet Exemplo de Robô:</h4>
              </div>
              
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Veja uma estrutura básica em Python que seu desenvolvedor ou você mesmo pode construir para bater os nomes:
              </p>

              <pre className="text-[9px] font-mono bg-slate-950 text-slate-300 p-3 rounded-xl overflow-x-auto border border-slate-800 leading-relaxed max-w-full">
{`# Exemplo Conceitual Robô MyHotel
import requests

my_hotel_reviews = [
  {"author": "Carlos E.", "rating": 5},
  {"author": "Julia Souza", "rating": 4}
]

# Ler convites pendentes do nosso backend
convites = requests.get(
  "http://hotel-app/api/convites-pendentes"
).json()

for invite in convites:
    nome = invite["guest_name"]
    # Comparar nomes
    if nome in [r["author"] for r in my_hotel_reviews]:
        # Sucesso! Aprovar no applet
        requests.post(
          "http://hotel-app/api/aprovar-convite",
          json={"id": invite["id"]}
        )
    else:
        # Se não bater, tentar novamente daqui a 5 dias`}
              </pre>

              <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl space-y-2">
                <h5 className="font-sans font-bold text-[10px] text-amber-700 dark:text-amber-400">💡 Como executar a aprovação hoje?</h5>
                <p className="text-[10px] text-slate-400">
                  Enquanto seu robô está em desenvolvimento, você ou sua equipe podem fazer essa mesma cruzagem visual na guia de <strong>Conciliação Externa</strong> e aprovar com um único clique.
                </p>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
