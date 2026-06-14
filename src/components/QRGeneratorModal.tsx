import React, { useState, useRef } from 'react';
import { 
  X, QrCode, Send, Copy, Download, 
  Check, ChevronRight, Edit3
} from 'lucide-react';
import { Platform, ReviewInvite } from '../types';
import { ApiService } from '../lib/api';
import { isDemoMode } from '../lib/supabase';
import { QRCodeSVG } from 'qrcode.react';

interface QRGeneratorModalProps {
  platform: Platform;
  onClose: () => void;
  onInviteCreated: (invite: ReviewInvite) => void;
  onInviteUpdated?: (invite: ReviewInvite) => void;
}

export default function QRGeneratorModal({ platform, onClose, onInviteCreated, onInviteUpdated }: QRGeneratorModalProps) {
  const [activeTab, setActiveTab] = useState<'options' | 'qr' | 'whatsapp'>('options');
  const [guestName, setGuestName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [complaint, setComplaint] = useState('');
  const [phone, setPhone] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generatedInvite, setGeneratedInvite] = useState<ReviewInvite | null>(null);
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [editingIssuedData, setEditingIssuedData] = useState(false);
  const [savingIssuedData, setSavingIssuedData] = useState(false);
  const qrRef = useRef<SVGSVGElement>(null);

  const hasGuestInfo = guestName.trim().length > 0 && roomNumber.trim().length > 0;

  // Auto format/mask phone (Brazilian formatting: XX XXXXX-XXXX)
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let clean = e.target.value.replace(/\D/g, '');
    if (clean.length > 11) clean = clean.substr(0, 11);
    
    let formatted = clean;
    if (clean.length > 2) {
      formatted = `(${clean.substring(0, 2)}) `;
      if (clean.length > 7) {
        formatted += `${clean.substring(2, 7)}-${clean.substring(7)}`;
      } else {
        formatted += clean.substring(2);
      }
    }
    setPhone(formatted);
  };

  const getFullTrackingUrl = (token: string) => {
    const configuredAppUrl = ((import.meta as any).env.VITE_APP_URL || '').trim().replace(/\/$/, '');
    const appUrl = configuredAppUrl || window.location.origin;
    const trackingPath = isDemoMode ? `/r/${token}` : `/api/r/${token}`;
    return `${appUrl}${trackingPath}`;
  };

  // 1. GENERATE QR CODE PATHWAY
  const generateQRCodeInvite = async () => {
    if (!hasGuestInfo) {
      alert('Favor inserir os dados obrigatórios do hóspede (Nome e número do Apartamento).');
      return;
    }
    setLoading(true);
    try {
      const invite = await ApiService.createInvite(
        platform.code, 
        'qr', 
        undefined, 
        guestName.trim(), 
        roomNumber.trim(),
        complaint.trim() || undefined
      );
      setGeneratedInvite(invite);
      onInviteCreated(invite);
      setActiveTab('qr');
    } catch (err) {
      console.error(err);
      alert('Erro ao criar convite. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // 2. GENERATE WHATSAPP PATHWAY
  const handleWhatsappSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasGuestInfo) {
      alert('Favor preencher o nome e apartamento do hóspede antes de emitir.');
      return;
    }
    const rawDigits = phone.replace(/\D/g, '');
    if (rawDigits.length < 10) {
      alert('Por favor, informe um número de telefone celular válido com DDD.');
      return;
    }

    // Pre-open the window synchronously to prevent browser popup blockers from intercepting the trigger
    const waWindow = window.open('about:blank', '_blank');

    setLoading(true);
    try {
      const countryCode = '+55';
      const formattedNumberWithCountry = `${countryCode} ${phone}`;
      
      const invite = await ApiService.createInvite(
        platform.code, 
        'whatsapp', 
        formattedNumberWithCountry,
        guestName.trim(),
        roomNumber.trim(),
        complaint.trim() || undefined
      );

      setGeneratedInvite(invite);
      onInviteCreated(invite);

      // Mount message text replacing placeholder {link} & {guest_name} if applicable
      const trackUrl = getFullTrackingUrl(invite.token);
      let text = platform.whatsapp_message_template || 'Olá {guest_name}! Agradecemos sua estadia. Nos avalie: {link}';
      text = text.replace('{link}', trackUrl);
      text = text.replace('{guest_name}', guestName.trim());

      // Trigger standard API URL Whatsapp
      const cleanedPhoneForWhatsapp = `55${rawDigits}`;
      const waUrl = `https://wa.me/${cleanedPhoneForWhatsapp}?text=${encodeURIComponent(text)}`;
      setWhatsappUrl(waUrl);

      if (waWindow) {
        waWindow.location.href = waUrl;
      }
      setActiveTab('whatsapp');
    } catch (err) {
      if (waWindow) {
        waWindow.close();
      }
      console.error(err);
      alert('Erro ao criar envio por WhatsApp. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!generatedInvite) return;
    const trackingUrl = getFullTrackingUrl(generatedInvite.token);
    navigator.clipboard.writeText(trackingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleIssuedDataSave = async () => {
    if (!generatedInvite) return;
    if (!guestName.trim() || !roomNumber.trim()) {
      alert('Preencha o nome e o apartamento antes de salvar.');
      return;
    }

    setSavingIssuedData(true);
    try {
      const res = await ApiService.updateInviteGuest(generatedInvite.id, guestName.trim(), roomNumber.trim());
      if (res.error || !res.invite) {
        alert(`Erro ao atualizar dados: ${res.error || 'convite nao retornado'}`);
        return;
      }

      setGeneratedInvite(res.invite);
      onInviteUpdated?.(res.invite);
      setEditingIssuedData(false);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Falha ao atualizar dados do convite.');
    } finally {
      setSavingIssuedData(false);
    }
  };

  const handleDownloadQR = () => {
    if (!qrRef.current) return;
    const svg = qrRef.current;
    const svgX = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgX], { type: 'image/svg+xml;charset=utf-8' });
    const blobUrl = URL.createObjectURL(svgBlob);
    
    // Create anchor link
    const downloadLink = document.createElement('a');
    downloadLink.href = blobUrl;
    downloadLink.download = `QRCode_Reviews_${platform.code}_${generatedInvite?.token || 'token'}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(blobUrl);
  };

  return (
    <div id="modal-container" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div id="modal-card" className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-100 flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <span 
              className="h-3 w-3 rounded-full shrink-0 animate-pulse" 
              style={{ backgroundColor: platform.color || '#475569' }} 
            />
            <h3 className="font-sans font-bold text-lg text-slate-800">
              Emitir para {platform.name}
            </h3>
          </div>
          <button 
            id="btn-close-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body / Tab layouts */}
        <div className="p-6 overflow-y-auto max-h-[75vh]">
          {activeTab === 'options' && (
            <div id="tab-options" className="space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed mb-1">
                Insira os dados de identificação do hóspede abaixo. O preenchimento do nome e do apartamento é obrigatório para validação e auditoria.
              </p>

              {/* Guest identification section */}
              <div className="bg-slate-50 p-4 border border-slate-150 rounded-xl space-y-3.5">
                <h4 className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">
                  Identificação do Hóspede
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">
                      Nome Completo *
                    </label>
                    <input
                      type="text"
                      required
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="Ex: Carlos Oliveira"
                      className="w-full text-xs p-2 border border-slate-200 bg-white rounded-lg outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">
                      Apartamento *
                    </label>
                    <input
                      type="text"
                      required
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value)}
                      placeholder="Ex: 304"
                      className="w-full text-xs p-2 border border-slate-200 bg-white rounded-lg outline-none focus:border-amber-500 animate-none"
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase flex items-center justify-between text-slate-500">
                      <span>Reclamações / Observações Internas (Opcional)</span>
                      <span className="text-[9px] text-amber-500 font-semibold lowercase">Apenas interno para equipe</span>
                    </label>
                    <textarea
                      value={complaint}
                      onChange={(e) => setComplaint(e.target.value)}
                      placeholder="Se houver alguma queixa feita pelo hóspede, relate aqui. Será registrado internamente no painel de Reclamações d'Admin."
                      rows={2}
                      className="w-full text-xs p-2 border border-slate-200 bg-white rounded-lg outline-none focus:border-amber-500 resize-none font-sans"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 my-2" />

              <button
                id="btn-option-qr"
                onClick={generateQRCodeInvite}
                disabled={loading}
                className={`w-full flex items-center justify-between p-4 bg-slate-50 border rounded-xl transition-all text-left group
                  ${hasGuestInfo 
                    ? 'border-slate-100 hover:border-amber-300 hover:bg-amber-50/20 cursor-pointer' 
                    : 'opacity-50 cursor-not-allowed border-slate-100'}`}
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-cyan-100 text-cyan-600 rounded-lg group-hover:bg-cyan-200 transition-colors">
                    <QrCode className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800 text-sm">Gerar QR Code</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-light">Escanear com a câmera direto na recepção</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-300 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                id="btn-option-whatsapp"
                onClick={() => {
                  if (!hasGuestInfo) {
                    alert('Insira primeiro o nome e apartamento do hóspede.');
                    return;
                  }
                  setActiveTab('whatsapp');
                }}
                className={`w-full flex items-center justify-between p-4 bg-slate-50 border rounded-xl transition-all text-left group
                  ${hasGuestInfo 
                    ? 'border-slate-100 hover:border-amber-300 hover:bg-amber-50/20 cursor-pointer' 
                    : 'opacity-50 cursor-not-allowed border-slate-100'}`}
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-lg group-hover:bg-emerald-200 transition-colors">
                    <Send className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800 text-sm">Enviar por WhatsApp</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-light">Disparar link personalizado via chat</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-300 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          )}

          {/* QR CODE DISPLAY TAB */}
          {activeTab === 'qr' && generatedInvite && (
            <div id="tab-qr" className="flex flex-col items-center text-center space-y-4">
              <p className="text-[11px] font-mono uppercase bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-bold">
                Cód (Token): {generatedInvite.token.replace('tok-', '')}
              </p>

              {/* Vector QR Code with Dynamic Palette Branding */}
              <div 
                className="p-5 bg-white rounded-2xl border-4 shadow-md transition-all duration-300 hover:scale-105" 
                style={{ borderColor: platform.color || '#e2e8f0' }}
              >
                <QRCodeSVG 
                  ref={qrRef}
                  value={getFullTrackingUrl(generatedInvite.token)} 
                  size={180} 
                  level="Q" 
                  marginSize={1}
                  fgColor={platform.color || '#0f172a'}
                />
              </div>

              <div className="max-w-xs space-y-1">
                <p className="text-xs font-bold text-slate-800">
                  QR Code Personalizado ({platform.name})
                </p>
                <p className="text-[11px] text-slate-500 leading-relaxed font-light">
                  Emitido para <span className="font-bold text-slate-700">{guestName}</span> (Apto <span className="font-bold text-slate-700">{roomNumber}</span>). Apresente a tela para o hóspede escanear.
                </p>
              </div>

              <div className="w-full rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-left space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                      Dados para conferencia
                    </p>
                    <p className="text-[11px] text-slate-600 leading-relaxed mt-0.5">
                      Ajuste o nome publico visto no Google/Trip antes de bater a avaliacao.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingIssuedData(prev => !prev)}
                    className="h-8 px-2.5 rounded-lg border border-amber-200 bg-white text-amber-800 hover:bg-amber-100 text-[11px] font-bold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>{editingIssuedData ? 'Fechar' : 'Editar'}</span>
                  </button>
                </div>

                {editingIssuedData ? (
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_96px] gap-2">
                    <input
                      type="text"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="h-9 rounded-lg border border-amber-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-amber-500"
                      placeholder="Nome real ou nome publico"
                    />
                    <input
                      type="text"
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value)}
                      className="h-9 rounded-lg border border-amber-200 bg-white px-3 text-xs font-mono font-bold text-slate-800 outline-none focus:border-amber-500"
                      placeholder="Apto"
                    />
                    <button
                      type="button"
                      onClick={handleIssuedDataSave}
                      disabled={savingIssuedData}
                      className="sm:col-span-2 h-9 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-50 transition-colors"
                    >
                      {savingIssuedData ? 'Salvando...' : 'Salvar dados do convite'}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-lg bg-white border border-amber-100 px-2.5 py-2">
                      <span className="block text-[9px] uppercase font-bold text-slate-400">Nome atual</span>
                      <strong className="block text-slate-800 truncate">{guestName}</strong>
                    </div>
                    <div className="rounded-lg bg-white border border-amber-100 px-2.5 py-2">
                      <span className="block text-[9px] uppercase font-bold text-slate-400">Apartamento</span>
                      <strong className="block text-slate-800 font-mono truncate">{roomNumber}</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* QR actions */}
              <div className="w-full grid grid-cols-2 gap-2.5 pt-4">
                <button
                  onClick={handleCopy}
                  id="btn-copy-code-link"
                  className="flex items-center justify-center space-x-2 border border-slate-200 hover:bg-slate-50 text-slate-700 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  <span>{copied ? 'Copiado!' : 'Copiar link'}</span>
                </button>
                <button
                  onClick={handleDownloadQR}
                  id="btn-download-qr-img"
                  className="flex items-center justify-center space-x-2 border border-slate-200 hover:bg-slate-50 text-slate-700 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  <span>Baixar QR</span>
                </button>
              </div>

              <button
                onClick={onClose}
                id="btn-qr-complete"
                className="w-full bg-slate-800 hover:bg-slate-900 text-white py-2.5 rounded-lg text-xs font-semibold mt-2 transition-colors shadow-sm cursor-pointer"
              >
                Concluir Convite
              </button>
            </div>
          )}

          {/* WHATSAPP SUBMIT FORM TAB */}
          {activeTab === 'whatsapp' && !generatedInvite && (
            <form onSubmit={handleWhatsappSubmit} id="form-whatsapp" className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-100/50 rounded-xl p-3.5 flex items-start space-x-3">
                <Send className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                <p className="text-xs text-emerald-800 leading-relaxed">
                  O link exclusivo rastreável será acoplado automaticamente à mensagem e enviado para o WhatsApp do hóspede.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">
                  Celular do Hóspede
                </label>
                <div className="flex space-x-2">
                  <div className="w-20 px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-center text-sm font-medium text-slate-600">
                    +55 (BR)
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={handlePhoneChange}
                    required
                    maxLength={15}
                    placeholder="(11) 99999-9999"
                    id="input-guest-phone"
                    className="flex-1 text-sm p-2 border border-slate-200 bg-white rounded-lg outline-none focus:border-amber-500 font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Nota: Para proteção de dados de privacidade (LGPD), o número completo será preservado de forma anônima nos relatórios públicos.
                </p>
              </div>

              <div className="pt-2 flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('options')}
                  className="flex-1 h-10 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  id="btn-submit-whatsapp"
                  className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'Processando...' : 'Gerar e Enviar'}
                </button>
              </div>
            </form>
          )}

          {/* WHATSAPP CONFIRMATION TAB (AFTER DISPATCH) */}
          {activeTab === 'whatsapp' && generatedInvite && (
            <div id="tab-whatsapp-done" className="text-center space-y-4 py-2">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <Check className="h-6 w-6" />
              </div>

              <div>
                <h4 className="font-sans font-bold text-base text-slate-800">Convite Gerado com Sucesso!</h4>
                <p className="text-xs text-slate-500 mt-2 max-w-xs leading-relaxed mx-auto">
                  Se a conversa com o WhatsApp não abriu automaticamente (devido ao bloqueador de pop-ups), clique no botão verde abaixo para iniciar o chat ou copie o link.
                </p>
              </div>

              {whatsappUrl && (
                <button
                  onClick={() => window.open(whatsappUrl, '_blank')}
                  className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-2 transition-colors cursor-pointer shadow-sm"
                >
                  <Send className="h-4 w-4" />
                  <span>Enviar / Abrir WhatsApp</span>
                </button>
              )}

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center justify-between text-left">
                <span className="text-[11px] font-mono text-slate-500 truncate mr-2">
                  {getFullTrackingUrl(generatedInvite.token)}
                </span>
                <button
                  onClick={handleCopy}
                  className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>

              <button
                onClick={onClose}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white py-2 rounded-lg text-xs font-semibold transition-colors mt-4 cursor-pointer"
              >
                Concluir
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
