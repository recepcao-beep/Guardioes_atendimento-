import React, { useState } from 'react';
import { 
  Sliders, Link2, MessageSquare, Check, AlertCircle, Sparkles 
} from 'lucide-react';
import { Platform } from '../../types';
import { ApiService } from '../../lib/api';

interface PlatformsConfigViewProps {
  platforms: Platform[];
  onRefresh: () => void;
}

export default function PlatformsConfigView({ platforms, onRefresh }: PlatformsConfigViewProps) {
  const [editingPlatform, setEditingPlatform] = useState<Platform | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [active, setActive] = useState(true);
  const [color, setColor] = useState('');
  const [whatsappTemplate, setWhatsappTemplate] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const startEditing = (p: Platform) => {
    setEditingPlatform(p);
    setName(p.name);
    setUrl(p.external_url || '');
    setActive(p.active);
    setColor(p.color || '#f59e0b');
    setWhatsappTemplate(p.whatsapp_message_template);
    setError(null);
    setSuccess(null);
  };

  const cancelEditing = () => {
    setEditingPlatform(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlatform) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await ApiService.updatePlatform(editingPlatform.id, {
        name,
        external_url: url,
        active,
        color,
        whatsapp_message_template: whatsappTemplate
      });

      setSuccess('Plataforma atualizada com sucesso!');
      onRefresh();
      setTimeout(() => setEditingPlatform(null), 1200);
    } catch (err: any) {
      setError(err.message || 'Falha ao atualizar parâmetros.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="platforms-config-panel" className="space-y-6">
      
      {/* Upper header */}
      <div>
        <h2 className="font-sans font-extrabold text-2xl text-slate-800 tracking-wide">
          Canais de Avaliação e Templates
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Configure as URLs finais de redirecionamento, cores temáticas e as mensagens padrão do WhatsApp para as avaliações.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-100 text-red-800 rounded-xl text-xs flex items-center space-x-2.5 shadow-sm">
          <AlertCircle className="h-4.5 w-4.5 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-xs flex items-center space-x-2.5 shadow-sm">
          <Check className="h-4.5 w-4.5 text-emerald-500 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* PLATFORMS SELECTOR LIST (LEFT SIDE) */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm lg:col-span-1 space-y-3">
          <h3 className="font-sans font-bold text-xs text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Plataformas</h3>
          
          {platforms.map((p) => {
            const isEditing = editingPlatform?.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => startEditing(p)}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all text-left group cursor-pointer
                  ${isEditing 
                    ? 'bg-amber-50/20 border-amber-300 ring-1 ring-amber-500/20' 
                    : 'bg-slate-50/50 border-slate-200/60 hover:bg-slate-50 hover:border-slate-350'}
                `}
              >
                <div className="flex items-center space-x-2.5">
                  <span 
                    className="h-3 w-3 rounded-full shrink-0" 
                    style={{ backgroundColor: p.color || '#94a3b8' }} 
                  />
                  <div>
                    <h4 className="font-bold text-xs text-slate-800">{p.name}</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-mono truncate max-w-[150px]">
                      {p.code === 'internal' ? p.external_url || 'MyHotel Premium' : p.external_url ? p.external_url : 'Página pendente'}
                    </p>
                  </div>
                </div>

                <span className={`text-[9px] font-mono font-bold uppercase shrink-0
                  ${p.active ? 'text-emerald-600' : 'text-slate-400'}
                `}>
                  {p.active ? 'Ativo' : 'Pausado'}
                </span>
              </button>
            );
          })}
        </div>

        {/* COMPONENT EDITOR PANEL (RIGHT SIDE) */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm lg:col-span-2">
          {editingPlatform ? (
            <form onSubmit={handleSave} className="space-y-5 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center space-x-2">
                  <Sliders className="h-4.5 w-4.5 text-amber-500" />
                  <span className="font-sans font-bold text-sm text-slate-800">
                    Ajustando Parâmetros: {editingPlatform.name}
                  </span>
                </div>
                <button 
                  type="button" 
                  onClick={cancelEditing} 
                  className="text-xs text-slate-400 hover:text-slate-650"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Nome Amigável</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full text-xs border border-slate-200 p-2 rounded-lg bg-slate-50 outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Cor Accent do Canal</label>
                  <div className="flex space-x-2">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-9 h-8 border border-slate-200 rounded-lg p-0 cursor-pointer overflow-hidden"
                    />
                    <input
                      type="text"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="flex-1 text-xs font-mono border border-slate-200 p-2 rounded-lg bg-slate-50 text-slate-700 outline-none"
                      placeholder="#ffffff"
                    />
                  </div>
                </div>

                {editingPlatform.code !== 'internal' && (
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">URL do Perfil Público (Avaliação Oficial)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                        <Link2 className="h-3.5 w-3.5" />
                      </div>
                      <input
                        type="url"
                        required
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://g.page/r/hotel-perfil/review"
                        className="w-full text-xs pl-8 border border-slate-200 p-2 rounded-lg bg-slate-50 outline-none font-mono"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400">O hóspede será encaminhado de forma segura após o escaneamento do código ou abertura do link de WhatsApp.</p>
                  </div>
                )}

                <div className="sm:col-span-2 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Mensagem Modelo do WhatsApp</label>
                    <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.2 rounded font-mono font-bold uppercase">Whats Outbox</span>
                  </div>
                  
                  <div className="relative">
                    <div className="absolute top-2.5 left-2.5 text-slate-400">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <textarea
                      required
                      rows={5}
                      value={whatsappTemplate}
                      onChange={(e) => setWhatsappTemplate(e.target.value)}
                      className="w-full text-xs pl-9 border border-slate-200 p-2.5 rounded-lg bg-slate-50 outline-none leading-relaxed text-slate-755 font-sans"
                    />
                  </div>
                  
                  <div className="bg-amber-55 bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-[10px] text-amber-900 leading-normal flex items-start space-x-2">
                    <Sparkles className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
                    <div>
                      <p className="font-bold text-amber-800">Dica de Tags do Motor:</p>
                      <p className="mt-0.5 text-slate-600">Use a palavra-chave <strong className="font-bold font-mono text-[10px]">{'{link}'}</strong> para injetar automaticamente o link rastreável exclusivo. Utilize <strong className="font-mono text-[10px]">{'{guest_name}'}</strong> para embutir o marcador do hóspede cadastrado.</p>
                    </div>
                  </div>
                </div>

                <div className="sm:col-span-2 pt-2 flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    className="rounded border-slate-900 text-amber-500"
                    id="edit-platform-active-checkbox"
                  />
                  <label htmlFor="edit-platform-active-checkbox" className="text-xs text-slate-600 select-none">
                    Plataforma operacional para emissão de novos convites
                  </label>
                </div>

              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  id="btn-save-platform"
                  className="bg-slate-900 hover:bg-slate-800 cursor-pointer text-white px-5 py-2 rounded-lg text-xs font-semibold flex items-center space-x-1"
                >
                  <span>{loading ? 'Salvando...' : 'Salvar Configurações'}</span>
                </button>
              </div>

            </form>
          ) : (
            <div id="no-platform-selected" className="flex flex-col items-center justify-center text-center py-16 text-slate-450">
              <Sliders className="h-10 w-10 text-slate-300 stroke-1" />
              <p className="text-xs font-sans font-bold text-slate-700 mt-3">Nenhum Canal Selecionado</p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                Selecione uma das plataformas na barra de opções ao lado para realizar os ajustes e ver os modelos.
              </p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
