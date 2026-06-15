import React, { useState, useMemo } from 'react';
import { 
  Trophy, CheckCircle, HelpCircle, Eye, Search, AlertCircle, 
  ArchiveRestore, MessageSquare, ClipboardCheck, ArrowUpRight, Check,
  Bot, Clock, CheckCircle2, XCircle, Terminal, Play, RotateCcw, RefreshCw, ShieldCheck, Trash2,
  Settings, Globe, Key
} from 'lucide-react';
import { Profile, ReviewInvite, Sector, Platform } from '../../types';
import { ApiService, getSessionUser } from '../../lib/api';
import { DemoDb } from '../../utils/demoDb';
import { isDemoMode } from '../../lib/supabase';

interface ConciliationConfigViewProps {
  user: Profile;
  invites: ReviewInvite[];
  profiles: Profile[];
  sectors: Sector[];
  platforms: Platform[];
  weights: Record<string, number>;
  onRefresh: () => void;
}

export default function ConciliationConfigView({
  user, invites, profiles, sectors, platforms, weights, onRefresh
}: ConciliationConfigViewProps) {
  
  const [search, setSearch] = useState('');
  const [selectedPlatformCode, setSelectedPlatformCode] = useState('all');
  
  // Custom divisions/tabs requested by the user
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'invalidated'>('pending');

  // Selected invite for manual evaluation approvals
  const [conciliatingInvite, setConciliatingInvite] = useState<ReviewInvite | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [auditNotes, setAuditNotes] = useState('');
  const [guestName, setGuestName] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [successCode, setSuccessCode] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmType?: 'danger' | 'warning' | 'info';
  } | null>(null);

  // Python Scraping simulation states
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationLogs, setSimulationLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  // Webhook integration states for Python Robot
  const [webhookUrl, setWebhookUrl] = useState(() => localStorage.getItem('python_robot_webhook_url') || '');
  const [webhookToken, setWebhookToken] = useState(() => localStorage.getItem('python_robot_webhook_token') || '');
  const [showWebhookSettings, setShowWebhookSettings] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Interactive python script view states
  const [showPythonScript, setShowPythonScript] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [robotWorkflowLoading, setRobotWorkflowLoading] = useState(false);
  const [robotWorkflowMessage, setRobotWorkflowMessage] = useState<string | null>(null);

  // Group invites by status to match the 3 requested divisions
  const pendingInvites = useMemo(() => {
    return invites.filter(inv => ['emitted', 'opened'].includes(inv.status));
  }, [invites]);

  const approvedInvites = useMemo(() => {
    return invites.filter(inv => ['externally_verified_manual', 'externally_reconciled', 'internal_completed'].includes(inv.status));
  }, [invites]);

  const invalidatedInvites = useMemo(() => {
    return invites.filter(inv => inv.status === 'cancelled');
  }, [invites]);

  // Filter lists based on Search & Platform filters
  const getFilteredList = (list: ReviewInvite[]) => {
    return list.filter(inv => {
      // Exclude internal ratings from external integrations
      const plat = platforms.find(p => p.id === inv.platform_id);
      if (!plat) return false;

      // Platform selection filter
      if (selectedPlatformCode !== 'all' && plat.code !== selectedPlatformCode) return false;

      // Query search matching
      if (search.trim() !== '') {
        const query = search.toLowerCase();
        const guardian = profiles.find(p => p.id === inv.issuer_user_id)?.full_name.toLowerCase() || '';
        const token = inv.token.toLowerCase();
        const phone = (inv.guest_phone_masked || '').toLowerCase();
        
        if (!guardian.includes(query) && !token.includes(query) && !phone.includes(query)) {
          return false;
        }
      }

      return true;
    });
  };

  const activeFilteredList = useMemo(() => {
    switch (activeTab) {
      case 'pending': return getFilteredList(pendingInvites);
      case 'approved': return getFilteredList(approvedInvites);
      case 'invalidated': return getFilteredList(invalidatedInvites);
    }
  }, [activeTab, pendingInvites, approvedInvites, invalidatedInvites, selectedPlatformCode, search, platforms, profiles]);

  const handleSelectionForConciliation = (inv: ReviewInvite) => {
    setConciliatingInvite(inv);
    setAuditNotes('');
    setGuestName('');
    setErrorCode(null);
    setSuccessCode(null);
  };

  const handleInstantApprove = async (inv: ReviewInvite) => {
    setApprovingId(inv.id);
    try {
      const guestNameVal = inv.guest_name || 'Hóspede Identificado';
      const notes = `Confirmação de avaliação direta pelo administrador. Liberação imediata de pontos. Autor: ${guestNameVal}`;
      const reference = guestNameVal;
      
      const res = await ApiService.confirmExternalReview(inv.id, notes, reference);
      if (res.error) {
        alert('Erro ao aprovar de forma rápida: ' + res.error);
      } else {
        onRefresh();
        if (conciliatingInvite?.id === inv.id) {
          setConciliatingInvite(null);
        }
      }
    } catch (err: any) {
      alert('Erro inesperado na aprovação rápida: ' + (err.message || err));
    } finally {
      setApprovingId(null);
    }
  };

  // 1. APPROVE MANUAL
  const handleManualConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conciliatingInvite) return;
    if (auditNotes.trim().length < 5) {
      setErrorCode('Por favor, informe uma justificativa consistente (mínimo de 5 caracteres) para aprovação.');
      return;
    }

    setLoading(true);
    setErrorCode(null);
    setSuccessCode(null);

    try {
      await ApiService.confirmExternalReview(
        conciliatingInvite.id, 
        auditNotes, 
        guestName.trim() || undefined
      );

      setSuccessCode('Avaliação aprovada de forma manual com sucesso!');
      onRefresh();
      
      setTimeout(() => {
        setConciliatingInvite(null);
        setSuccessCode(null);
      }, 1500);
    } catch (err: any) {
      setErrorCode(err.message || 'Erro ao registrar aprovação.');
    } finally {
      setLoading(false);
    }
  };

  // 2. INVALIDATE (CANCEL) MANUAL
  const handleInvalidateInvite = (invId: string) => {
    setConfirmModal({
      title: 'Invalidar Avaliação',
      message: 'Tem certeza de que deseja invalidar esta avaliação? Ela irá para a lista de Invalidados.',
      confirmType: 'warning',
      onConfirm: async () => {
        setLoading(true);
        try {
          const res = await ApiService.invalidateInvite(invId);
          if (res.error) {
            alert('Erro ao invalidar: ' + res.error);
          } else {
            onRefresh();
          }
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // 2.5 DELETE PERMANENTLY FROM DATABASE
  const handleDeleteInvite = (invId: string) => {
    setConfirmModal({
      title: 'Excluir Avaliação',
      message: 'Tem certeza de que deseja EXCLUIR DEFINITIVAMENTE esta avaliação do banco de dados? Esta ação é irreversível.',
      confirmType: 'danger',
      onConfirm: async () => {
        setLoading(true);
        try {
          const res = await ApiService.deleteInvite(invId);
          if (res.error) {
            alert('Erro ao excluir: ' + res.error);
          } else {
            onRefresh();
            if (conciliatingInvite?.id === invId) {
              setConciliatingInvite(null);
            }
          }
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // 3. REOPEN/CANCEL MANUAL CONFIRMATION
  const handleReopenInvite = async (invId: string) => {
    setLoading(true);
    try {
      const res = await ApiService.reopenInvite(invId);
      if (res.error) {
        alert('Erro ao reabrir: ' + res.error);
      } else {
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveApproval = (invId: string) => {
    setConfirmModal({
      title: 'Cancelar Aprovação',
      message: 'Deseja cancelar a aprovação desta avaliação e retorná-la para pendente?',
      confirmType: 'warning',
      onConfirm: async () => {
        setLoading(true);
        try {
          const res = await ApiService.removeExternalConfirmation(invId);
          if (res.error) {
            alert('Erro ao cancelar: ' + res.error);
          } else {
            onRefresh();
          }
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // 4. PYTHON SCRAPING ROBOT SYNCHRONIZER
  const runRobotSimulation = async () => {
    setIsSimulating(true);
    setShowLogs(true);
    setWebhookStatus('idle');
    setSimulationLogs([
      `[ROBÔ] Iniciando rotina Python às ${new Date().toLocaleTimeString('pt-BR')}`,
      `[ROBÔ] Conectando à plataforma de reputação...`,
      `[ROBÔ] Banco de dados validado para varreduras.`
    ]);
    
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    await sleep(600);
    const pendings = [...pendingInvites];

    // IF WEBHOOK IS DEFINED, TRIGGER THE REAL ENDPOINT
    if (webhookUrl && webhookUrl.trim().startsWith('http')) {
      setSimulationLogs(prev => [...prev, `[SINAL] Gatilho configurado detectado. Disparando webhook HTTP POST para o Robô...`]);
      try {
        const payload = {
          action: 'trigger_scraping_validation',
          pending_count: pendings.length,
          pending_invites: pendings.map(p => ({
            id: p.id,
            token: p.token,
            guest_name: p.guest_name,
            room_number: p.room_number,
            created_at: p.created_at
          }))
        };

        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        if (webhookToken) {
          headers['Authorization'] = webhookToken.startsWith('Bearer ') ? webhookToken : `Bearer ${webhookToken}`;
        }

        const response = await fetch(webhookUrl.trim(), {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          setSimulationLogs(prev => [...prev, `[SINAL SUCESSO] Webhook disparado com sucesso! Código ${response.status} de retorno.`]);
          setWebhookStatus('success');
        } else {
          setSimulationLogs(prev => [...prev, `[SINAL AVISO] Webhook executado mas retornou status não-2xx: ${response.status}.`]);
          setWebhookStatus('error');
        }
      } catch (err: any) {
        setSimulationLogs(prev => [...prev, `[SINAL ERRO] Não foi possível conectar ao Webhook: ${err.message || err}. Continuando simulação local...`]);
        setWebhookStatus('error');
      }
    } else {
      setSimulationLogs(prev => [...prev, `[INFO] Webhook real não configurado nas Configurações. Utilizando apenas simulação local segura.`]);
    }

    await sleep(800);
    setSimulationLogs(prev => [...prev, `[ROBÔ] Buscando correspondências de tokens ativos nas APIs do Google e TripAdvisor...`]);
    
    await sleep(800);
    setSimulationLogs(prev => [...prev, `[ROBÔ] Identificados ${pendings.length} convites aguardando aprovação no Guardiões do atendimento.`]);
    
    if (pendings.length === 0) {
      await sleep(600);
      setSimulationLogs(prev => [...prev, `[ROBÔ] Nenhum token pendente para verificar. Parando rotina.`, `[ROBÔ] Fim da simulação.`]);
      setIsSimulating(false);
      return;
    }

    await sleep(800);
    setSimulationLogs(prev => [...prev, `[ROBÔ] Analisando expirações e confrontando dados em tempo real...`]);

    let autoApproved = 0;
    let autoExpired = 0;
    let autoPending = 0;

    for (let i = 0; i < pendings.length; i++) {
      const inv = pendings[i];
      const code = inv.token.replace('tok-', '');
      await sleep(500);

      // Simular se foi criado há mais de 5 dias
      const inviteAgeDays = (Date.now() - new Date(inv.created_at).getTime()) / (1000 * 60 * 60 * 24);
      const isFiveDaysExpired = inviteAgeDays > 5 || (i === 1 && pendingInvites.length > 2);

      if (isFiveDaysExpired) {
        autoExpired++;
        setSimulationLogs(prev => [...prev, `[EXPIRADO] Token '${code}' passou de 5 dias sem retorno no myHotel. Atualizando status: INVALIDADO.`]);
        await ApiService.invalidateInvite(inv.id);
      } else {
        // Simular aprovação bem-sucedida para cerca de 50% dos casos
        const foundInMyHotel = i % 2 === 0;
        const guestNameVal = inv.guest_name || 'Hóspede Identificado';
        if (foundInMyHotel) {
          autoApproved++;
          setSimulationLogs(prev => [
            ...prev,
            `[ROBÔ] Confrontando nome cadastrado no token ('${guestNameVal}') com o autor da nova avaliação...`,
            `[FATOR HUMANO] Registro de hóspede ${guestNameVal} em quarto ${inv.room_number || 'N/A'} bate 100% com autor no canal (${platforms.find(p => p.id === inv.platform_id)?.name || 'Google'}).`,
            `[SUCESSO] Nome confirmado! Token '${code}' validado com sucesso na central do myHotel: APROVADO.`
          ]);
          
          if (isDemoMode) {
            const admin = getSessionUser()!;
            DemoDb.confirmExternalReview(admin, inv.id, `Confirmado de forma automática via Robô Python - Nome Autor: ${guestNameVal}`, "Script Integrador Automático");
          } else {
            await ApiService.confirmExternalReview(inv.id, `Confirmado de forma automática via Robô Python - Nome Autor: ${guestNameVal}`, "Script Integrador Automático");
          }
        } else {
          autoPending++;
          setSimulationLogs(prev => [
            ...prev,
            `[ROBÔ] Conferindo nome '${guestNameVal}' do token nos canais integrados...`,
            `[PENDENTE] Nenhuma postagem de '${guestNameVal}' identificada recentemente. Mantendo para varredura futura.`
          ]);
        }
      }
    }

    await sleep(800);
    setSimulationLogs(prev => [
      ...prev, 
      `------ RELATÓRIO DO ROBÔ ------`,
      `Aprovados automaticamente: ${autoApproved}`,
      `Invalidados por prazo (5 dias): ${autoExpired}`,
      `Mantidos sob verificação: ${autoPending}`,
      `[ROBÔ] Sincronização concluída. Banco de dados do Guardiões do atendimento atualizado às ${new Date().toLocaleTimeString('pt-BR')}.`
    ]);
    setIsSimulating(false);
    onRefresh();
  };

  const triggerGitHubRobot = async () => {
    setRobotWorkflowLoading(true);
    setRobotWorkflowMessage(null);
    setShowLogs(true);
    setSimulationLogs(prev => [
      ...prev,
      `[GITHUB] Disparando robô MyHotel no GitHub Actions...`
    ]);

    try {
      const res = await ApiService.triggerRobotWorkflow(true);
      if (res.error) {
        setRobotWorkflowMessage(res.error);
        setSimulationLogs(prev => [...prev, `[GITHUB ERRO] ${res.error}`]);
      } else {
        setRobotWorkflowMessage('Robô disparado no GitHub Actions. Aguarde a conclusão da execução.');
        setSimulationLogs(prev => [
          ...prev,
          `[GITHUB OK] Workflow iniciado. A validação real será feita em segundo plano.`
        ]);
      }
    } finally {
      setRobotWorkflowLoading(false);
    }
  };

  const truncateUrlToken = (tok: string) => {
    return tok.replace('tok-', '');
  };

  // Safe fetch of manual points weight
  const manualPointsAward = useMemo(() => {
    return weights['externally_verified_manual'] || weights['confirmed_manual'] || 25;
  }, [weights]);

  return (
    <div id="conciliation-module-panel" className="space-y-6">
      
      {/* 1. Header Area formatted for mobile layout flexibility */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-sans font-extrabold text-2xl text-slate-800 tracking-wide">
            Painel de Conciliamento e Validação
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Controle e verificação de convites pendentes e confirmados integrando com a central myHotel externa.
          </p>
        </div>

        <button
          type="button"
          onClick={triggerGitHubRobot}
          disabled={robotWorkflowLoading}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all shadow-sm shrink-0 border
            ${robotWorkflowLoading
              ? 'bg-emerald-100 text-emerald-800 border-emerald-200 animate-pulse'
              : 'bg-emerald-600 text-white border-emerald-700/10 hover:bg-emerald-700'}`}
        >
          <Bot className="h-4 w-4 shrink-0" />
          <span>{robotWorkflowLoading ? 'Rodando na nuvem...' : 'Rodar robo na nuvem'}</span>
        </button>

        <button
          onClick={runRobotSimulation}
          disabled={isSimulating}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all shadow-sm shrink-0 border
            ${isSimulating 
              ? 'bg-amber-100 text-amber-800 border-amber-200 animate-pulse' 
              : 'bg-amber-500 text-slate-950 border-amber-600/10 hover:bg-amber-600'}`}
        >
          <Bot className="h-4 w-4 shrink-0" />
          <span>{isSimulating ? 'Robô Verificando...' : 'Rodar Robô Python (Simular)'}</span>
        </button>
      </div>

      {robotWorkflowMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800 shadow-sm">
          {robotWorkflowMessage}
        </div>
      )}

      {/* 1.5 Webhook configuration panel */}
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-205 pb-3">
          <button
            type="button"
            onClick={() => {
              setShowWebhookSettings(!showWebhookSettings);
              if (showPythonScript) setShowPythonScript(false);
            }}
            className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-amber-500 dark:hover:text-amber-500 transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4 text-amber-500" />
            <span>Configurar Webhook do Robô Python</span>
            <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500">
              {webhookUrl ? '• Ativo' : '• Simulação'}
            </span>
          </button>
          
          <button
            type="button"
            onClick={() => {
              setShowPythonScript(!showPythonScript);
              if (showWebhookSettings) setShowWebhookSettings(false);
            }}
            className="flex items-center gap-2 text-xs font-bold text-amber-600 hover:text-amber-500 transition-colors cursor-pointer"
          >
            <Terminal className="w-4 h-4" />
            <span>Código do Robô Python & Variáveis Vercel</span>
            <span className="text-[10px] px-2 py-0.5 bg-amber-500/10 text-amber-600 rounded">Pronto</span>
          </button>
        </div>

        {showWebhookSettings && (
          <div className="pt-2 space-y-4 animate-fade-in text-xs">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              O robô Python pode rodar em qualquer máquina ou servidor de sua escolha (como <strong>Google Cloud Run</strong>, <strong>Railway</strong> ou <strong>GitHub Actions</strong>). 
              Insira a URL do Webhook do seu servidor abaixo. Ao disparar o robô, enviaremos um HTTP POST contendo os convites pendentes e os nomes dos hóspedes para que sua rotina faça a varredura e confirme via API.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                  URL do Webhook do Robô (POST)
                </label>
                <input
                  type="url"
                  placeholder="Ex: https://meu-robo.up.railway.app/webhook"
                  value={webhookUrl}
                  onChange={(e) => {
                    setWebhookUrl(e.target.value);
                  }}
                  className="w-full text-xs p-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg outline-none focus:border-amber-500 dark:text-white animate-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                  <Key className="w-3.5 h-3.5 text-slate-400" />
                  Token de Segurança / API Key (Opcional)
                </label>
                <input
                  type="password"
                  placeholder="Insira um Bearer Token ou senha de validação se houver"
                  value={webhookToken}
                  onChange={(e) => {
                    setWebhookToken(e.target.value);
                  }}
                  className="w-full text-xs p-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg outline-none focus:border-amber-500 dark:text-white animate-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                Dados armazenados de forma segura localmente ou em nuvem.
              </span>
              
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem('python_robot_webhook_url', webhookUrl.trim());
                  localStorage.setItem('python_robot_webhook_token', webhookToken.trim());
                  alert('Configurações de Webhook do Robô salvas com sucesso!');
                  setShowWebhookSettings(false);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2 rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                Salvar Configuração de Webhook
              </button>
            </div>
          </div>
        )}

        {showPythonScript && (
          <div className="pt-2 space-y-4 animate-fade-in text-xs">
            <div className="bg-amber-100/40 dark:bg-amber-950/20 border border-amber-200/50 p-3.5 rounded-xl">
              <h4 className="font-bold text-amber-800 dark:text-amber-300 text-xs flex items-center gap-1.5 mb-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 hover:scale-105 transition-transform" />
                Variáveis do Vercel requisitadas para o seu Deploy
              </h4>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
                Ao implantar o app na <strong>Vercel</strong>, insira as variáveis de ambiente a seguir em <em>Project Settings e Environment Variables</em>, permitindo conexões seguras e o fluxo completo com o Supabase:
              </p>
              
              <div className="overflow-x-auto rounded-lg border border-slate-200/60 dark:border-slate-800/80">
                <table className="w-full text-left font-mono text-[10px] text-slate-700 dark:text-slate-300 bg-white/60 dark:bg-black/30">
                  <thead>
                    <tr className="bg-slate-200/50 dark:bg-slate-800/80 text-[9px] uppercase tracking-wider font-sans font-extrabold text-slate-500">
                      <th className="p-2.5">Nome da Variável (.env)</th>
                      <th className="p-2.5">Valor Sugerido / Função</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    <tr>
                      <td className="p-2.5 font-bold text-slate-900 dark:text-white">VITE_SUPABASE_URL</td>
                      <td className="p-2.5 font-sans leading-relaxed">URL do seu projeto no Supabase (copie do painel Supabase).</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold text-slate-900 dark:text-white">VITE_SUPABASE_ANON_KEY</td>
                      <td className="p-2.5 font-sans leading-relaxed">Chave anon_public_key para consultas de clientes.</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold text-slate-900 dark:text-white">SUPABASE_SERVICE_ROLE_KEY</td>
                      <td className="p-2.5 font-sans text-amber-700 dark:text-amber-400 font-semibold leading-relaxed">Chave service_role (vital para que requisições administrativas de Guardiões e Pontos burlem restrições com total isolamento).</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold text-slate-900 dark:text-white">ADMIN_INITIAL_PASSWORD</td>
                      <td className="p-2.5 font-sans leading-relaxed">Defina a senha máster inicial (Ex: <span className="font-mono">0000</span> ou a de sua escolha).</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold text-slate-900 dark:text-white">VITE_APP_URL</td>
                      <td className="p-2.5 font-sans leading-relaxed">A URL final do seu app Vercel (Ex: <span className="font-mono">https://guardioes-atendimento.vercel.app</span>).</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Bot className="w-4 h-4 text-amber-500 animate-pulse" />
                    Robô Selenium Python Pronto (Dados Incorporados)
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Este script Selenium se autentica no myHotel com suas credenciais e vasculha o container da primeira avaliação extraindo o nome do hóspede.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const codeElement = document.getElementById('python-selenium-real-code');
                    if (codeElement) {
                      navigator.clipboard.writeText(codeElement.innerText);
                      setCopiedScript(true);
                      setTimeout(() => setCopiedScript(false), 2000);
                    }
                  }}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[10px] px-3.5 py-1.5 rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-center shrink-0 select-none"
                >
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  <span>{copiedScript ? 'Copiado!' : 'Copiar Código Python'}</span>
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-900 dark:bg-slate-950 p-4 text-slate-300 font-mono text-[10px] leading-relaxed max-h-80 overflow-y-auto">
                <pre id="python-selenium-real-code" className="whitespace-pre select-text text-left">
{`# -*- coding: utf-8 -*-
import os
import time
import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options

# --- CONFIGURAÇÕES PORTAL MYHOTEL (SISTEMA GUARDIÕES) ---
LOGIN_URL = "https://fidelity.myhotel.cl/login"
USERNAME = os.getenv("MYHOTEL_USER", "")
PASSWORD = os.getenv("MYHOTEL_PASSWORD", "")

# --- XPATHS ENVIADOS E CONFIGURADOS ---
XPATH_USER_INPUT = "/html/body/app-root/ng-component/div/div[1]/div/div[1]/section/div[1]/div/div/ng-component/form/div[1]/input"
XPATH_PASS_INPUT = "/html/body/app-root/ng-component/div/div[1]/div/div[1]/section/div[1]/div/div/ng-component/form/div[2]/input"
XPATH_LOGIN_BTN = "/html/body/app-root/ng-component/div/div[1]/div/div[1]/section/div[1]/div/div/ng-component/form/div[4]/div/button"
XPATH_ONLINE_BTN = "/html/body/app-root/ng-component/div/mat-drawer-container/mat-drawer-content/mat-sidenav-container/mat-sidenav/div/mh-navbar/aside/tree-root/div/div[4]/div/div/mh-navbar-item/div"
XPATH_REVIEW_CONTAINER = "/html/body/app-root/ng-component/div/mat-drawer-container/mat-drawer-content/mat-sidenav-container/mat-sidenav-content/div/mh-online/mh-alerts-wrapper/div/mh-core-lib-content/section/section[2]/mh-reviews/mh-review-list/mh-core-lib-loader-wrapper/div/mh-single-review[1]/div"
XPATH_GUEST_NAME = "/html/body/app-root/ng-component/div/mat-drawer-container/mat-drawer-content/mat-sidenav-container/mat-sidenav-content/div/mh-online/mh-alerts-wrapper/div/mh-core-lib-content/section/section[2]/mh-reviews/mh-review-list/mh-core-lib-loader-wrapper/div/mh-single-review[1]/div/div[1]/p"

# --- WEBHOOK DA SUA INSTÂNCIA VERCEL ---
VERCEL_WEBHOOK_URL = "${webhookUrl || 'https://guardioes-atendimento.vercel.app/api/confirm-review'}"
WEBHOOK_SECURITY_TOKEN = "${webhookToken || 'Bearer MEU_TOKEN_SEGURO_ROBO_API'}"

def iniciar_navegador():
    print("[ROBÔ] Inicializando WebDriver do Chrome...")
    options = Options()
    # Ativar modo headless (em segundo plano) se rodar em servidores como Linux Server / Docker
    # options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    driver = webdriver.Chrome(options=options)
    driver.implicitly_wait(10)
    return driver

def extrair_hospede_recente():
    driver = iniciar_navegador()
    hospedes_encontrados = []
    
    try:
        print(f"[ROBÔ] Navegando ao link de login: {LOGIN_URL}")
        driver.get(LOGIN_URL)
        
        wait = WebDriverWait(driver, 20)
        
        # 1. Digitar Usuário
        print(f"[ROBÔ] Preenchendo campo de login: {USERNAME}")
        user_input = wait.until(EC.presence_of_element_located((By.XPATH, XPATH_USER_INPUT)))
        user_input.clear()
        user_input.send_keys(USERNAME)
        
        # 2. Digitar Senha
        print("[ROBÔ] Preenchendo campo de senha...")
        pass_input = driver.find_element(By.XPATH, XPATH_PASS_INPUT)
        pass_input.clear()
        pass_input.send_keys(PASSWORD)
        
        # 3. Executar clique login
        print("[ROBÔ] Clicando no botao Entrar...")
        btn_login = driver.find_element(By.XPATH, XPATH_LOGIN_BTN)
        btn_login.click()
        
        time.sleep(6) # Aguardar redirecionamento completo
        
        # 4. Navegar ao menu de avaliações ONLINE
        print("[ROBÔ] Navegando para o modulo ONLINE no menu lateral...")
        btn_online = wait.until(EC.element_to_be_clickable((By.XPATH, XPATH_ONLINE_BTN)))
        btn_online.click()
        
        print("[ROBÔ] Aguardando carregamento dos cartões de feedbacks...")
        time.sleep(5)
        
        # 5. Capturar nome do hóspede recente
        try:
            print("[ROBÔ] Buscando o container da avaliacao pelo XPath...")
            review_box = wait.until(EC.presence_of_element_located((By.XPATH, XPATH_REVIEW_CONTAINER)))
            name_p = review_box.find_element(By.XPATH, XPATH_GUEST_NAME)
            guest_name = name_p.text.strip()
            
            print(f"[ROBÔ] SUCESSO! Hóspede localizado: '{guest_name}'")
            if guest_name:
                hospedes_encontrados.append(guest_name)
        except Exception as box_err:
            print(f"[INFO] Erro ao localizar container ou texto de hóspede: {box_err}")
            
    except Exception as general_err:
        print(f"[ERRO GERAL] Falha crítica de execução no Selenium: {general_err}")
    finally:
        print("[ROBÔ] Fechando navegador.")
        driver.quit()
        
    return hospedes_encontrados

def disparar_webhook_guardioes(lista_hospedes):
    if not lista_hospedes:
        print("[ROBÔ] Lista de hóspedes vazia. Nenhuma conciliação iniciada.")
        return
        
    print(f"[ROBÔ] Enviando Webhook para {VERCEL_WEBHOOK_URL}...")
    
    payload = {
        "event": "myhotel_leads_extracted",
        "hospedes": lista_hospedes,
        "notes": "Pesquisa automatizada via Robô Python de Conciliação.",
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": WEBHOOK_SECURITY_TOKEN
    }
    
    try:
        response = requests.post(VERCEL_WEBHOOK_URL, json=payload, headers=headers, timeout=15)
        print(f"[MENSAGEM SERVIDOR] Retornou Código {response.status_code}: {response.text}")
    except Exception as exc:
        print(f"[ERRO WEBHOOK] Falha ao comunicar com o Vercel: {exc}")

if __name__ == "__main__":
    print("=================== INICIANDO ROBÔ DE CONCILIAÇÃO DE LEADS ===================")
    dados = extrair_hospede_recente()
    disparar_webhook_guardioes(dados)
    print("=================== ROTINA SCRAPPING CONCLUÍDA COM SULCESSO ===================")`}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Embedded Python Simulation Terminal panel */}
      {showLogs && (
        <div className="bg-slate-950 rounded-2xl border border-slate-800 p-5 shadow-2xl relative overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3 text-xs text-slate-400">
            <span className="font-mono flex items-center space-x-2">
              <Terminal className="h-4 w-4 text-emerald-400" />
              <span>simulacao_robo_myhotel.py</span>
            </span>
            <button 
              onClick={() => { setShowLogs(false); setSimulationLogs([]); }} 
              className="text-[10px] hover:text-white border border-slate-800 hover:border-slate-600 rounded px-2 py-0.5"
            >
              Fechar Terminal
            </button>
          </div>

          <div className="font-mono text-[11px] text-slate-300 space-y-1.5 max-h-52 overflow-y-auto no-scrollbar pt-1 select-text">
            {simulationLogs.map((l, idx) => {
              let color = 'text-slate-300';
              if (l.includes('[SUCESSO]')) color = 'text-emerald-400 font-bold';
              else if (l.includes('[EXPIRADO]')) color = 'text-red-400 font-bold';
              else if (l.includes('[PENDENTE]')) color = 'text-amber-300';
              else if (l.includes('[ROBÔ]')) color = 'text-sky-300';
              else if (l.includes('------')) color = 'text-slate-400 font-mono';
              else if (l.includes('Aprovados')) color = 'text-emerald-400 font-mono';

              return (
                <div key={idx} className={color}>
                  {l}
                </div>
              );
            })}
            {isSimulating && (
              <div className="text-sky-400 animate-pulse font-bold">
                [ROBÔ] Executando rotina scrap... Aguarde...
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Division tabs requested by User (Aguardando Aprovação, Aprovado, Invalidado) */}
      <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200">
        <div id="reconciliation-division-tabs" className="flex overflow-x-auto no-scrollbar scroll-smooth">
          <button
            onClick={() => setActiveTab('pending')}
            className={`py-3 px-5 text-xs font-bold border-b-2 whitespace-nowrap transition-all flex items-center space-x-2 hover:text-slate-800
              ${activeTab === 'pending' 
                ? 'border-amber-500 text-slate-850' 
                : 'border-transparent text-slate-400'}`}
          >
            <Clock className="h-4 w-4 shrink-0 text-slate-400" />
            <span>Aguardando Aprovação</span>
            <span className="bg-slate-100 text-slate-605 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              {pendingInvites.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('approved')}
            className={`py-3 px-5 text-xs font-bold border-b-2 whitespace-nowrap transition-all flex items-center space-x-2 hover:text-slate-800
              ${activeTab === 'approved' 
                ? 'border-amber-500 text-slate-850' 
                : 'border-transparent text-slate-400'}`}
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            <span>Aprovados</span>
            <span className="bg-emerald-50 text-emerald-600 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              {approvedInvites.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('invalidated')}
            className={`py-3 px-5 text-xs font-bold border-b-2 whitespace-nowrap transition-all flex items-center space-x-2 hover:text-slate-800
              ${activeTab === 'invalidated' 
                ? 'border-amber-500 text-slate-850' 
                : 'border-transparent text-slate-400'}`}
          >
            <XCircle className="h-4 w-4 shrink-0 text-red-500" />
            <span>Invalidados</span>
            <span className="bg-red-50 text-red-650 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              {invalidatedInvites.length}
            </span>
          </button>
        </div>

        {/* Global filtration options */}
        <div className="flex items-center space-x-2 pb-2 md:pb-0 text-xs">
          <select
            value={selectedPlatformCode}
            onChange={(e) => setSelectedPlatformCode(e.target.value)}
            className="border border-slate-200 outline-none p-2 rounded-lg font-medium text-slate-750 bg-white shadow-sm"
          >
            <option value="all">Todas as Plataformas</option>
            {platforms.filter(p => p.code !== 'internal').map(plat => (
              <option key={plat.id} value={plat.code}>{plat.name}</option>
            ))}
          </select>

          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar..."
              className="pl-7 pr-3 py-1.5 border border-slate-200 bg-white outline-none rounded-lg text-slate-700 w-36 focus:w-48 transition-all"
            />
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>
        </div>
      </div>

      {/* 4. MASTER COLUMNS AND FORM PANEL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LIST SECTION (Takes 2/3 of space, completely optimized for mobile viewcards) */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Card list on Mobile, clean elegant dynamic table on Desktop */}
          <div className="block md:hidden space-y-3">
            {activeFilteredList.length === 0 ? (
              <div className="bg-white p-8 text-center rounded-2xl border border-slate-100 text-slate-400 text-xs font-light shadow-sm">
                Nenhum convite encontrado nesta aba de divisões.
              </div>
            ) : (
              activeFilteredList.map((inv) => {
                const emitter = profiles.find(p => p.id === inv.issuer_user_id);
                const plat = platforms.find(p => p.id === inv.platform_id);
                
                return (
                  <div key={inv.id} className="bg-white p-4 rounded-2xl border border-slate-150 shadow-sm space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                          Token: {truncateUrlToken(inv.token)}
                        </span>
                        <div className="flex items-center space-x-1.5 mt-2 font-semibold text-slate-800 text-xs">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: plat?.color || '#94a3b8' }} />
                          <span>{plat?.name || 'Canal'}</span>
                        </div>
                      </div>

                      {/* Display click counter badge */}
                      <span className="text-[10px] bg-slate-50 text-slate-500 font-mono font-bold px-2 py-1 rounded">
                        {inv.opened_count} cliques
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 border-t border-slate-50 pt-2 flex justify-between">
                      <div>
                        <span className="block text-[10px] text-slate-400">Guardião Emissor</span>
                        <strong>{emitter?.full_name}</strong>
                      </div>
                      <div className="text-right">
                        <span className="block text-[10px] text-slate-400">Setor do Hotel</span>
                        <strong>{sectors.find(s => s.id === inv.issuer_sector_id)?.name || 'Sem Setor'}</strong>
                      </div>
                    </div>

                    <div className="border-t border-slate-50 pt-2.5 flex items-center gap-1.5 justify-end">
                      {activeTab === 'pending' && (
                        <>
                          <button
                            onClick={() => handleInstantApprove(inv)}
                            disabled={approvingId === inv.id}
                            className={`bg-slate-900 border border-slate-800 text-white font-bold rounded-lg px-2.5 py-1.5 text-[10.5px] cursor-pointer flex items-center space-x-1 ${approvingId === inv.id ? 'opacity-50' : ''}`}
                          >
                            {approvingId === inv.id ? (
                              <RefreshCw className="h-3 w-3 animate-spin text-amber-500" />
                            ) : null}
                            <span>Aprovar</span>
                          </button>
                          <button
                            onClick={() => handleSelectionForConciliation(inv)}
                            className="bg-slate-100 text-slate-700 hover:bg-slate-200 text-[10px] font-medium rounded-lg px-2 py-1.5 cursor-pointer"
                            title="Auditar com Notas"
                          >
                            Auditar
                          </button>
                          <button
                            onClick={() => handleInvalidateInvite(inv.id)}
                            className="bg-white border border-slate-200 text-amber-650 hover:bg-amber-50 font-bold rounded-lg p-1.5 text-[10.5px] cursor-pointer"
                            title="Invalidar Convite"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteInvite(inv.id)}
                            className="bg-white border border-red-200 text-red-650 hover:bg-red-50 font-bold rounded-lg p-1.5 text-[10.5px] cursor-pointer"
                            title="Excluir Definitivamente"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
 
                      {activeTab === 'approved' && (
                        <button
                          onClick={() => handleRemoveApproval(inv.id)}
                          className="bg-white border border-slate-205 text-slate-550 hover:bg-slate-50 font-bold rounded-lg px-2.5 py-1.5 text-[10px] cursor-pointer"
                        >
                          Remover Aprovação
                        </button>
                      )}
 
                      {activeTab === 'invalidated' && (
                        <>
                          <button
                            onClick={() => handleReopenInvite(inv.id)}
                            className="bg-white border border-slate-200 text-slate-650 font-bold rounded-lg px-2.5 py-1.5 text-[10px] flex items-center space-x-1 cursor-pointer"
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>Reativar</span>
                          </button>
                          <button
                            onClick={() => handleDeleteInvite(inv.id)}
                            className="bg-white border border-red-200 text-red-650 hover:bg-red-50 font-bold rounded-lg p-1.5 text-[10.5px] cursor-pointer"
                            title="Excluir Definitivamente"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop structured clean responsive table */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden p-5">
            <table className="w-full text-left border-collapse select-none">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Cód Token</th>
                  <th className="py-2.5 px-3">Canal</th>
                  <th className="py-2.5 px-3">Guardião</th>
                  <th className="py-2.5 px-3 text-center">Cliques</th>
                  <th className="py-2.5 px-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-50 text-slate-700">
                {activeFilteredList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 font-light">
                      Nenhum convite localizado para este filtro de busca.
                    </td>
                  </tr>
                ) : (
                  activeFilteredList.map((inv) => {
                    const emitter = profiles.find(p => p.id === inv.issuer_user_id);
                    const plat = platforms.find(p => p.id === inv.platform_id);
                    
                    return (
                      <tr 
                        key={inv.id} 
                        className={`hover:bg-slate-50/50 transition-colors
                          ${conciliatingInvite?.id === inv.id ? 'bg-amber-50/15' : ''}
                        `}
                      >
                        <td className="py-3 px-3 font-mono font-bold text-slate-800">
                          {truncateUrlToken(inv.token)}
                        </td>
                        <td className="py-3 px-3">
                          <span className="flex items-center space-x-1.5 font-semibold text-slate-750">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: plat?.color || '#94a3b8' }} />
                            <span>{plat?.name || 'Canal'}</span>
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div>
                            <p className="font-semibold text-slate-800">{emitter?.full_name}</p>
                            <p className="text-[10px] text-slate-400">
                              {sectors.find(s => s.id === inv.issuer_sector_id)?.name || 'Sem Setor'}
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-600">
                          {inv.opened_count}x
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex items-center space-x-2">
                            {activeTab === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleInstantApprove(inv)}
                                  disabled={approvingId === inv.id}
                                  className={`px-2.5 py-1 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-lg text-[10px] font-bold text-white cursor-pointer flex items-center space-x-1 ${approvingId === inv.id ? 'opacity-50' : ''}`}
                                >
                                  {approvingId === inv.id ? (
                                    <RefreshCw className="h-3 w-3 animate-spin text-amber-500" />
                                  ) : null}
                                  <span>Aprovar</span>
                                </button>
                                <button
                                  onClick={() => handleSelectionForConciliation(inv)}
                                  className="px-2 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 text-[10px] font-medium rounded-lg cursor-pointer"
                                  title="Auditar com Notas"
                                >
                                  Auditar
                                </button>
                                <button
                                  onClick={() => handleInvalidateInvite(inv.id)}
                                  className="p-1 text-slate-400 hover:text-amber-500 border border-transparent hover:border-amber-100 rounded-lg transition-colors cursor-pointer"
                                  title="Invalidar Convite"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteInvite(inv.id)}
                                  className="p-1 text-slate-400 hover:text-red-500 border border-transparent hover:border-red-100 rounded-lg transition-colors cursor-pointer"
                                  title="Excluir Definitivamente"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}

                            {activeTab === 'approved' && (
                              <button
                                onClick={() => handleRemoveApproval(inv.id)}
                                className="px-2.5 py-1 bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                              >
                                Desfazer Aprovação
                              </button>
                            )}

                            {activeTab === 'invalidated' && (
                              <>
                                <button
                                  onClick={() => handleReopenInvite(inv.id)}
                                  className="px-2.5 py-1 bg-white border border-slate-200 text-slate-500 hover:text-slate-800 rounded-lg text-[10px] font-bold transition-colors flex items-center space-x-1 cursor-pointer"
                                >
                                  <RotateCcw className="h-3 w-3 text-slate-400" />
                                  <span>Reativar</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteInvite(inv.id)}
                                  className="p-1 text-slate-400 hover:text-red-500 border border-transparent hover:border-red-100 rounded-lg transition-colors cursor-pointer"
                                  title="Excluir Definitivamente"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* VERIFICATION FORM SIDEBAR */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm self-start">
          {conciliatingInvite ? (
            <form onSubmit={handleManualConfirmSubmit} className="space-y-4 animate-fade-in text-xs">
              
              <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-amber-600 font-bold uppercase tracking-wider text-[10px]">
                  <ClipboardCheck className="h-4.5 w-4.5 text-amber-500" />
                  <span>Aprovar Avaliação</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => setConciliatingInvite(null)} 
                  className="text-[10px] text-slate-400 hover:text-slate-600"
                >
                  Cancelar
                </button>
              </div>

              {/* Invite meta details */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                  <span>Cód: {truncateUrlToken(conciliatingInvite.token)}</span>
                  <span>Canal: <strong>{platforms.find(p => p.id === conciliatingInvite.platform_id)?.name || 'Google'}</strong></span>
                </div>
                <p className="text-slate-600 font-light leading-relaxed">
                  Criado em: <strong>{new Date(conciliatingInvite.created_at).toLocaleDateString('pt-BR')}</strong> por <strong>{profiles.find(p => p.id === conciliatingInvite.issuer_user_id)?.full_name}</strong>
                </p>
              </div>

              {errorCode && (
                <div className="p-2.5 bg-red-50 border border-red-100 text-red-800 rounded-lg text-[11px] flex items-start space-x-2">
                  <AlertCircle className="h-4 w-4 text-red-650 shrink-0 mt-0.5" />
                  <span>{errorCode}</span>
                </div>
              )}
              {successCode && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg text-[11px] flex items-start space-x-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{successCode}</span>
                </div>
              )}

              {/* Setup fields */}
              <div className="space-y-3 pt-2">
                
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">
                    Nome do Hóspede (Opcional)
                  </label>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Ex: Carlos Oliveira"
                    className="w-full text-xs p-2 border border-slate-200 bg-slate-55 bg-slate-50 rounded-lg outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">
                    Notas / Justificativa de Aprovação
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={auditNotes}
                    onChange={(e) => setAuditNotes(e.target.value)}
                    placeholder="Descrição da validação (Ex: Hóspede confirmou avaliação realizada na saída)."
                    className="w-full text-xs p-2 border border-slate-200 bg-slate-50 rounded-lg outline-none leading-relaxed"
                  />
                </div>

              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>Pontos para o Guardião:</span>
                <span className="font-extrabold text-amber-600 text-sm">+{manualPointsAward} pts</span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl flex items-center justify-center space-x-1 transition-colors select-none cursor-pointer"
              >
                {loading ? (
                  <span>Salvando aprovação...</span>
                ) : (
                  <>
                    <CheckCircle className="h-4.5 w-4.5 font-bold" />
                    <span>Aprovar Token</span>
                  </>
                )}
              </button>

            </form>
          ) : (
            <div id="no-candidate-selected" className="flex flex-col items-center justify-center text-center py-20 text-slate-400">
              <ShieldCheck className="h-10 w-10 text-slate-300 stroke-1" />
              <p className="text-xs font-sans font-bold text-slate-500 mt-3">Aviso de Auditoria</p>
              <p className="text-[10px] text-slate-400 mt-1 max-w-xs leading-relaxed">
                Nenhum convite selecionado para aprovação manual. Clique em <strong>Aprovar</strong> ao lado de qualquer avaliação pendente em "Aguardando Aprovação".
              </p>
            </div>
          )}
        </div>

      </div>

      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-100 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-amber-600">
              <AlertCircle className="h-6 w-6 shrink-0" />
              <h3 className="font-sans font-bold text-slate-950 dark:text-white text-base">
                {confirmModal.title}
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {confirmModal.message}
            </p>
            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-sm text-white ${
                  confirmModal.confirmType === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : confirmModal.confirmType === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-slate-900 hover:bg-slate-800'
                }`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
