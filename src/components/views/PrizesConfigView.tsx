import React, { useState, useRef } from 'react';
import { 
  Calendar, Award, Sparkles, Plus, Edit2, Upload, Trash2, 
  Check, AlertCircle, FileImage, FolderKanban, Info,
  Eye, EyeOff, CheckCircle2, XCircle
} from 'lucide-react';
import { MonthlyPrize, Sector } from '../../types';
import { ApiService } from '../../lib/api';
import { motion, AnimatePresence } from 'motion/react';

interface PrizesConfigViewProps {
  prizes: MonthlyPrize[];
  sectors: Sector[];
  onRefresh: () => void;
}

export default function PrizesConfigView({ prizes, sectors, onRefresh }: PrizesConfigViewProps) {
  
  const [showForm, setShowForm] = useState(false);
  const [editingPrize, setEditingPrize] = useState<MonthlyPrize | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [refMonth, setRefMonth] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [imagePath, setImagePath] = useState('');
  const [active, setActive] = useState(true);
  const [footerTextLeft, setFooterTextLeft] = useState('');
  const [footerTextRight, setFooterTextRight] = useState('');

  // File Upload states
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Status indicators
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Preset unsplash illustrations for fast clicking
  const presets = [
    { title: 'Bonificação em Dinheiro', url: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=800&q=80' },
    { title: 'Diária em Hotel', url: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80' },
    { title: 'Jantar Gourmet em Restaurante', url: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=80' },
    { title: 'Jantar na Pizzaria', url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80' }
  ];

  const handleOpenCreate = () => {
    setEditingPrize(null);
    setTitle('');
    setDescription('');
    
    const d = new Date();
    const curr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setRefMonth(curr);
    setSectorId('');
    setImagePath(presets[0].url);
    setActive(true);
    setFooterTextLeft('Pontuação computada até o final do dia.');
    setFooterTextRight('Cada Conversão = +10 pontos');
    
    setError(null);
    setSuccess(null);
    setShowForm(true);
  };

  const handleOpenEdit = (pr: MonthlyPrize) => {
    setEditingPrize(pr);
    setTitle(pr.title);
    setDescription(pr.description);
    setRefMonth(pr.reference_month);
    setSectorId(pr.sector_id || '');
    setImagePath(pr.image_path || presets[0].url);
    setActive(pr.active);
    setFooterTextLeft(pr.footer_text_left || 'Pontuação computada até o final do dia.');
    setFooterTextRight(pr.footer_text_right || 'Cada Conversão = +10 pontos');
    
    setError(null);
    setSuccess(null);
    setShowForm(true);
  };

  // Direct toggle active action from the card list
  const handleToggleActiveDirect = async (pr: MonthlyPrize, e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    setError(null);
    setSuccess(null);
    const updatedStatus = !pr.active;

    try {
      await ApiService.savePrize({
        id: pr.id,
        title: pr.title,
        description: pr.description,
        reference_month: pr.reference_month,
        sector_id: pr.sector_id,
        image_path: pr.image_path,
        active: updatedStatus,
        footer_text_left: pr.footer_text_left,
        footer_text_right: pr.footer_text_right
      });
      setSuccess(`Campanha "${pr.title}" ${updatedStatus ? 'ativada' : 'desativada'} com sucesso!`);
      onRefresh();
      
      // Clear status message after 3.5s
      setTimeout(() => {
        setSuccess(null);
      }, 3500);
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao alterar o status do prêmio.');
    } finally {
      setLoading(false);
    }
  };

  // Drag handlings for file upload
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value && e.target.files && e.target.files[0]) {
      processUploadedFile(e.target.files[0]);
    }
  };

  const processUploadedFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Por favor, faça upload apenas de arquivos do tipo imagem (.jpg, .jpeg, .png).');
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setImagePath(String(e.target.result));
        setUploading(false);
      }
    };
    reader.onerror = () => {
      alert('Erro ao processar imagem.');
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const values = {
      id: editingPrize?.id, // VERY IMPORTANT: Include original ID for editing and updating!
      title,
      description,
      reference_month: refMonth,
      sector_id: sectorId || null,
      image_path: imagePath,
      active,
      footer_text_left: footerTextLeft,
      footer_text_right: footerTextRight
    };

    try {
      await ApiService.savePrize(values);
      setSuccess(`Campanha de premiação "${title}" salva e atualizada com sucesso!`);

      onRefresh();
      setTimeout(() => {
        setShowForm(false);
        setSuccess(null);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Falha ao salvar prêmio.');
    } finally {
      setLoading(false);
    }
  };

  const getSectorName = (id: string | null) => {
    if (!id) return 'Todo o Hotel (Geral)';
    return sectors.find(s => s.id === id)?.name || 'Geral';
  };

  const getReadableMonth = (monthISO: string) => {
    const [year, month] = monthISO.split('-');
    const mNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${mNames[parseInt(month, 10) - 1] || month} de ${year}`;
  };

  return (
    <div id="prizes-config-panel" className="space-y-6 max-w-7xl mx-auto pb-12">

      {/* Header and top buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 text-[10px] uppercase font-mono font-extrabold tracking-wider bg-indigo-500/10 text-indigo-550 dark:text-indigo-400 border border-indigo-500/20 rounded-full">
              Incentivos & Campanhas
            </span>
            <div className="flex items-center space-x-1 text-slate-400 font-mono text-xs">
              <span>•</span>
              <span className="font-semibold">{prizes.length} cadastradas</span>
            </div>
          </div>
          <h2 className="font-sans font-extrabold text-2xl md:text-3xl text-slate-800 dark:text-slate-100 tracking-tight mt-1 flex items-center gap-2">
            Campanhas & Prêmios do Mês 🏆
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Crie, ative, desative e gerencie as campanhas ativas de premiação. Colaboradores de destaque visualizam estes prêmios no painel para se manterem engajados.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          id="btn-add-prize"
          className="flex items-center justify-center space-x-2 bg-slate-900 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-600 hover:bg-slate-800 text-white px-5 py-3 rounded-xl text-xs font-bold shadow-sm shrink-0 transition-all cursor-pointer"
        >
          <Plus className="h-4.5 w-4.5" />
          <span>Nova Campanha</span>
        </button>
      </div>

      {/* Banner de status */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 text-red-800 dark:text-red-200 rounded-2xl text-xs flex items-center space-x-2.5 shadow-sm"
          >
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
        {success && (
          <motion.div 
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-200 rounded-2xl text-xs flex items-center space-x-2.5 shadow-sm"
          >
            <Check className="h-5 w-5 text-emerald-500 shrink-0" />
            <span>{success}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CREATION/EDIT BOX (INLINE ACCORDION) */}
      <AnimatePresence>
        {showForm && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-6 md:p-8 rounded-3xl shadow-sm space-y-6 overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-slate-205 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 bg-amber-500/10 text-amber-500 rounded-lg">
                  <Award className="h-4.5 w-4.5" />
                </div>
                <h3 className="font-sans font-bold text-sm text-slate-800 dark:text-slate-100">
                  {editingPrize ? `Modificar Campanha: ${editingPrize.title}` : 'Nova Campanha de Hospitalidade'}
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => setShowForm(false)} 
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-250 font-semibold cursor-pointer"
              >
                Cancelar
              </button>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              
              {/* Fields parameters - left */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Título do Prêmio / Campanha</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Jantar Gourmet em Restaurante, Diária em Hotel..."
                    className="w-full text-xs p-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 rounded-xl outline-none focus:border-amber-500 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mês de Referência</label>
                    <input
                      type="month"
                      required
                      value={refMonth}
                      onChange={(e) => setRefMonth(e.target.value)}
                      className="w-full text-xs p-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 rounded-xl outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Setor Concorrente</label>
                    <select
                      value={sectorId}
                      onChange={(e) => setSectorId(e.target.value)}
                      className="w-full text-xs p-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 rounded-xl outline-none focus:border-amber-500 transition-colors cursor-pointer"
                    >
                      <option value="">Geral (Hotel Todo)</option>
                      {sectors.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Descrição Pró-Incentivo</label>
                  <textarea
                    required
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Explique os requisitos adicionais ou as vantagens de participar da campanha de hospitalidade..."
                    className="w-full text-xs p-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 rounded-xl outline-none leading-relaxed focus:border-amber-500 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Texto Rodapé Esquerdo</label>
                    <input
                      type="text"
                      required
                      value={footerTextLeft}
                      onChange={(e) => setFooterTextLeft(e.target.value)}
                      placeholder="Ex: Pontuação computada até o final do dia."
                      className="w-full text-xs p-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 rounded-xl outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Info Pontos (Rodapé Direito)</label>
                    <input
                      type="text"
                      required
                      value={footerTextRight}
                      onChange={(e) => setFooterTextRight(e.target.value)}
                      placeholder="Ex: Cada Conversão = +10 pontos"
                      className="w-full text-xs p-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 rounded-xl outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-100/50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-800/80 rounded-xl flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="block font-bold text-slate-800 dark:text-slate-250">Status de Ativação</span>
                    <span className="text-[10px] text-slate-400 font-light block">Se ativada, os colaboradores verão o prêmio em tempo real no feed.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActive(!active)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      active ? 'bg-amber-500' : 'bg-slate-350 dark:bg-slate-800'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        active ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Drag Drop artwork upload - right */}
              <div className="space-y-4">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Imagem Ilustrativa da Recompensa</label>
                
                <div 
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-5 text-center flex flex-col items-center justify-center cursor-pointer transition-all h-48 relative overflow-hidden
                    ${dragActive ? 'border-amber-500 bg-amber-50/10' : 'border-slate-250 hover:border-amber-400 dark:border-slate-800 dark:hover:border-slate-700 bg-white dark:bg-slate-950'}
                  `}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/*"
                    className="hidden"
                  />
                  
                  {imagePath ? (
                    <div className="absolute inset-0 p-1">
                      <img 
                        src={imagePath} 
                        alt="Preview" 
                        className="w-full h-full object-cover rounded-xl"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-slate-950/70 text-slate-100 py-2 text-[9px] font-mono tracking-wider">
                        Arraste ou clique para substituir
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-500 mx-auto">
                        <Upload className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-700 dark:text-slate-300">Escolha uma arte ou solte aqui</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Formatos suportados: PNG, JPG, JPEG</p>
                      </div>
                    </div>
                  )}
                  
                  {uploading && (
                    <div className="absolute inset-0 bg-slate-100/90 dark:bg-slate-950/90 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-300">
                      Processando Imagem...
                    </div>
                  )}
                </div>

                {/* Fast presets selection */}
                <div className="space-y-2">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Ou selecione um modelo instantâneo:
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {presets.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setImagePath(p.url)}
                        className={`p-2 border rounded-xl hover:border-amber-400 text-left text-[11px] truncate transition-all cursor-pointer flex items-center space-x-1.5
                          ${imagePath === p.url 
                            ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-400 font-bold' 
                            : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/30 text-slate-650 dark:text-slate-400 hover:bg-slate-50'
                          }
                        `}
                      >
                        <div className="h-4 w-4 rounded-full bg-cover shrink-0" style={{ backgroundImage: `url(${p.url})` }} />
                        <span className="truncate">{p.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Form buttons */}
              <div className="md:col-span-2 pt-5 border-t border-slate-200 dark:border-slate-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-none rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  id="btn-confirm-save-prize"
                  className="bg-slate-900 border border-slate-850 text-white dark:bg-amber-505 dark:bg-amber-550 dark:hover:bg-amber-600 hover:bg-slate-800 dark:bg-amber-500 dark:text-slate-950 dark:border-none px-6 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
                >
                  <span>{loading ? 'Processando...' : 'Salvar Campanha'}</span>
                </button>
              </div>

            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LIST OF REWARDS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 pt-2">
        {prizes.map((pr) => (
          <div 
            key={pr.id} 
            className={`bg-white dark:bg-slate-900 border rounded-3xl overflow-hidden flex flex-col justify-between shadow-xs hover:shadow transition-all group duration-300
              ${pr.active 
                ? 'border-indigo-500/10 dark:border-indigo-500/20 ring-1 ring-indigo-500/5' 
                : 'border-slate-100 dark:border-slate-800/80 opacity-80'
              }
            `}
          >
            
            {/* Image head of card */}
            <div className="flex h-44 relative shrink-0 overflow-hidden">
              <img 
                src={pr.image_path || presets[0].url} 
                alt={pr.title} 
                className="w-full h-full object-cover group-hover:scale-105 duration-700 transition-transform ease-out" 
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent h-28" />
              
              {/* Active Toggle badge inside image box */}
              <button
                onClick={(e) => handleToggleActiveDirect(pr, e)}
                title={pr.active ? "Clique para desativar a campanha" : "Clique para ativar a campanha"}
                className={`absolute top-4 right-4 px-3 py-1.5 rounded-full text-[10px] font-sans font-extrabold tracking-wider uppercase transition-all shadow-sm flex items-center space-x-1.5 cursor-pointer border
                  ${pr.active 
                    ? 'bg-emerald-500/90 text-white border-emerald-400 hover:bg-emerald-600' 
                    : 'bg-slate-900/90 text-slate-200 border-slate-700 hover:bg-slate-800'
                  }
                `}
              >
                {pr.active ? (
                  <>
                    <Eye className="h-3 w-3 shrink-0 text-emerald-100" />
                    <span>Campanha Ativa</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="h-3 w-3 shrink-0 text-slate-400" />
                    <span>Desativada</span>
                  </>
                )}
              </button>

              <div className="absolute bottom-4 left-4 flex items-center space-x-1.5 text-xs font-bold text-amber-300 font-mono">
                <Calendar className="h-4 w-4" />
                <span>{getReadableMonth(pr.reference_month)}</span>
              </div>
            </div>

            {/* Campaign info block */}
            <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-1.5">
                  <span className="px-2.5 py-0.5 text-[9px] font-extrabold tracking-wide rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase font-mono">
                    {getSectorName(pr.sector_id)}
                  </span>
                  {!pr.active && (
                    <span className="px-2 py-0.5 text-[9px] font-bold bg-slate-100 text-slate-450 dark:bg-slate-800 dark:text-slate-400 rounded uppercase font-mono">
                      Arquivada
                    </span>
                  )}
                </div>
                <h4 className="font-sans font-extrabold text-base text-slate-800 dark:text-slate-100 tracking-tight leading-snug group-hover:text-amber-500 duration-200 transition-colors">
                  {pr.title}
                </h4>
                <p className="text-slate-500 dark:text-slate-450 text-xs leading-relaxed font-light line-clamp-3">
                  {pr.description}
                </p>
              </div>

              {/* Footer actions */}
              <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 flex items-center justify-between">
                
                {/* Micro-guide explanation depending on active state */}
                <div className="flex items-center space-x-1 text-[10px] text-slate-400">
                  {pr.active ? (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      Visível aos colaboradores
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <XCircle className="h-3 w-3 text-slate-400" />
                      Oculta no feed principal
                    </span>
                  )}
                </div>

                {/* Edit params button */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleOpenEdit(pr)}
                    className="flex items-center space-x-1.5 px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-amber-500 hover:bg-amber-500/5 text-[10px] text-slate-700 dark:text-slate-300 font-bold transition-all cursor-pointer"
                  >
                    <Edit2 className="h-3 w-3 text-slate-400" />
                    <span>Editar Informações</span>
                  </button>
                  
                  <button
                    onClick={(e) => handleToggleActiveDirect(pr, e)}
                    className={`px-3 py-2 rounded-xl text-[10px] font-bold transition-all cursor-pointer border flex items-center space-x-1
                      ${pr.active 
                        ? 'bg-red-50 hover:bg-red-100 border-red-155 text-red-600 border-red-200' 
                        : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-155 text-emerald-600 border-emerald-200'
                      }`}
                  >
                    <span>{pr.active ? 'Suspender' : 'Ativar'}</span>
                  </button>
                </div>

              </div>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
}
