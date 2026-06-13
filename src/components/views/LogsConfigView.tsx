import React, { useState, useMemo } from 'react';
import { 
  FileText, Search, Filter, ShieldAlert, Clock, ArrowRight, UserCircle2 
} from 'lucide-react';
import { AuditLog, Profile } from '../../types';

interface LogsConfigViewProps {
  logs: AuditLog[];
  profiles: Profile[];
}

export default function LogsConfigView({ logs, profiles }: LogsConfigViewProps) {
  
  const [search, setSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState('all');
  const [selectedTriggerBy, setSelectedTriggerBy] = useState('all');

  // Compile list of unique action types
  const actionTypes = useMemo(() => {
    const list = new Set<string>();
    logs.forEach(l => {
      if (l.action) list.add(l.action);
    });
    return Array.from(list);
  }, [logs]);

  // Filters application
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Action type filter
      if (selectedAction !== 'all' && log.action !== selectedAction) return false;

      // User trigger filter
      if (selectedTriggerBy !== 'all' && log.actor_user_id !== selectedTriggerBy) return false;

      // Search box filter
      if (search.trim() !== '') {
        const query = search.toLowerCase();
        const act = (log.action || '').toLowerCase();
        const userTriggerName = profiles.find(p => p.id === log.actor_user_id)?.full_name.toLowerCase() || 'sistema';
        
        // Match meta details values too
        const metaValues = JSON.stringify(log.metadata || {}).toLowerCase();
        
        if (!act.includes(query) && !userTriggerName.includes(query) && !metaValues.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [logs, profiles, selectedAction, selectedTriggerBy, search]);

  const getActionColorLabel = (action: string) => {
    const actLower = action.toLowerCase();
    if (actLower.includes('login') || actLower.includes('acesso')) {
      return { text: 'Acesso Portal', color: 'bg-blue-50 text-blue-800 border-blue-100' };
    } else if (actLower.includes('cancel') || actLower.includes('exclu')) {
      return { text: 'Revogação', color: 'bg-rose-50 text-rose-800 border-rose-100' };
    } else if (actLower.includes('emissão') || actLower.includes('cri') || actLower.includes('create')) {
      return { text: 'Emissão/Geração', color: 'bg-emerald-50 text-emerald-800 border-emerald-100' };
    } else if (actLower.includes('concili') || actLower.includes('manual')) {
      return { text: 'Conciliação OK', color: 'bg-amber-50 text-amber-800 border-amber-100 font-bold' };
    } else if (actLower.includes('edição') || actLower.includes('altera') || actLower.includes('update')) {
      return { text: 'Configuração', color: 'bg-indigo-50 text-indigo-800 border-indigo-100' };
    }
    return { text: action, color: 'bg-slate-50 text-slate-700 border-slate-100' };
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return 'Sistema [Automático]';
    return profiles.find(p => p.id === userId)?.full_name || 'Sistema [Automático]';
  };

  // Dynamically format a beautiful Portuguese summary paragraph describing the action based on its metadata and keys
  const formatLogSummaryParagraph = (log: AuditLog) => {
    const act = log.action.toLowerCase();
    const meta = log.metadata || {};
    
    // Check key terms
    if (act.includes('login')) {
      return `Efetuou acesso administrativo autenticado via canal seguro SSL.`;
    }
    if (act.includes('emissão') || act.includes('convite')) {
      return `Gerou um novo link rastreável para avaliação pelo método de entrega "${meta.method || 'QR Code'}" visando a plataforma "${meta.platform || 'Canal Oficial'}".`;
    }
    if (act.includes('concili')) {
      return `Realizou a conciliação manual da conversão atribuindo créditos de hospitalidade ao colaborador correspondente. Justificativa: "${meta.justificativa || meta.notes || 'Evidence verified by administration'}"`;
    }
    if (act.includes('cri') && log.entity_type === 'profiles') {
      return `Cadastrou um novo colaborador ("${meta.nome || meta.full_name || 'Guardião'}") vinculado ao departamento do hotel correspondente.`;
    }
    if (act.includes('setor')) {
      return `Configurou parâmetros operacionais do setor departamental do hotel ("${meta.nome || 'Setor'}").`;
    }
    if (act.includes('pesos') || act.includes('ranking')) {
      return `Reajustou as pontuações e multiplicadores de ponderação de engajamento do ranking geral.`;
    }
    if (act.includes('prêmio')) {
      return `Oficializou a nova campanha e prêmio de prêmio de staff ("${meta.title || meta.titulo || 'Performance Award'}") para o mês de referência correspondente.`;
    }

    // Generic fallback builder
    const keys = Object.keys(meta);
    if (keys.length > 0) {
      const details = keys.map(k => `${k}: ${JSON.stringify(meta[k])}`).join(', ');
      return `Realizou a operação de ${log.action} na entidade ${log.entity_type} (${details}).`;
    }
    return `Realizou com êxito a ação de "${log.action}" na tabela de sistema "${log.entity_type}".`;
  };

  return (
    <div id="logs-panel-layout" className="space-y-6">
      
      {/* Upper header */}
      <div>
        <h2 className="font-sans font-extrabold text-2xl text-slate-800 tracking-wide">
          Securização e Logs de Ações (Auditoria)
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Histórico e trilha de auditoria corporativa. Rastreabilidade completa de todas as emissões e conciliações de prêmios.
        </p>
      </div>

      {/* FILTER PANEL */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        
        {/* Search */}
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-slate-500 uppercase">Busca por Descrição</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
              <Search className="h-3.5 w-3.5" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquise nos logs de auditoria..."
              className="w-full text-xs pl-8 border border-slate-200 outline-none p-2 rounded-lg bg-slate-50 text-slate-700 font-sans"
            />
          </div>
        </div>

        {/* Action filter */}
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-slate-500 uppercase">Tipo de Ação</label>
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="w-full text-xs bg-slate-55 border border-slate-200 outline-none p-2 rounded-lg text-slate-700 bg-white"
          >
            <option value="all">Ver Todas as Ações</option>
            {actionTypes.map(act => (
              <option key={act} value={act}>{act}</option>
            ))}
          </select>
        </div>

        {/* User Triggered trigger by filter */}
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-slate-500 uppercase">Autor da Ação</label>
          <select
            value={selectedTriggerBy}
            onChange={(e) => setSelectedTriggerBy(e.target.value)}
            className="w-full text-xs bg-slate-55 border border-slate-200 outline-none p-2 rounded-lg text-slate-700 bg-white"
          >
            <option value="all">Qualquer Usuário / Sistema</option>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{p.full_name} ({p.role === 'admin' ? 'Gestor' : 'Guardião'})</option>
            ))}
          </select>
        </div>

      </div>

      {/* AUDIT LOG TIMELINE */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
        
        <div className="flex items-center space-x-2.5 text-slate-800 border-b border-slate-100 pb-3">
          <FileText className="h-5 w-5 text-slate-400" />
          <h3 className="font-sans font-bold text-sm">Trilha de Operações Auditadas</h3>
        </div>

        <div className="space-y-4">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-10 text-slate-400 font-light">
              Nenhum log auditado correspondente ao filtro de trilha atual.
            </div>
          ) : (
            filteredLogs.map((log) => {
              const actionLabel = getActionColorLabel(log.action);
              const authorName = getUserName(log.actor_user_id);
              return (
                <div 
                  key={log.id} 
                  className="flex items-start space-x-4 border-l border-slate-150 pl-4 py-1.5 relative hover:bg-slate-50/50 transition-all rounded-r-lg"
                >
                  {/* Timeline dot */}
                  <div className="h-3 w-3 bg-white border-2 border-slate-400 hover:border-slate-800 rounded-full absolute -left-1.5 top-2.5 transition-colors" />

                  {/* Log payload details */}
                  <div className="flex-1 space-y-1 text-xs text-slate-700 leading-normal">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-semibold border px-2 py-0.5 rounded ${actionLabel.color}`}>
                        {actionLabel.text}
                      </span>
                      
                      <span className="flex items-center space-x-1 text-slate-400 text-[10px] font-mono">
                        <Clock className="h-3.5 w-3.5" />
                        <span>
                          {new Date(log.created_at).toLocaleString('pt-BR', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit', second: '2-digit'
                          })}
                        </span>
                      </span>
                    </div>

                    <p className="text-slate-800 font-normal leading-relaxed max-w-2xl pt-0.5">
                      {formatLogSummaryParagraph(log)}
                    </p>

                    <div className="flex items-center space-x-1.5 text-[10px] text-slate-500 font-mono pt-1">
                      <UserCircle2 className="h-3.5 w-3.5 text-slate-400" />
                      <span>Autorizado por: <strong className="text-slate-700 font-bold">{authorName}</strong></span>
                      {log.metadata && (
                        <>
                          <span className="text-slate-350">|</span>
                          <span className="text-amber-600 font-bold uppercase text-[9px]">ID: {log.entity_id ? log.entity_id.split('-')[0] : 'Geral'}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

    </div>
  );
}
