import React, { useState } from 'react';
import { FolderKanban, Plus, Edit2, ToggleLeft, ToggleRight, Check, AlertCircle, Trash2 } from 'lucide-react';
import { Sector, Profile, ReviewInvite } from '../../types';
import { ApiService } from '../../lib/api';

interface SectorsConfigViewProps {
  sectors: Sector[];
  profiles: Profile[];
  invites: ReviewInvite[];
  onRefresh: () => void;
}

export default function SectorsConfigView({ sectors, profiles, invites, onRefresh }: SectorsConfigViewProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  
  const [name, setName] = useState('');
  const [active, setActive] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Computations for sector stats
  const getSectorStats = (secId: string) => {
    const guardiansCount = profiles.filter(p => p.sector_id === secId && p.role === 'guardian').length;
    const sectorInvites = invites.filter(i => i.issuer_sector_id === secId);
    const conversions = sectorInvites.filter(i => 
      ['internal_completed', 'externally_verified_manual', 'externally_reconciled'].includes(i.status)
    ).length;

    return {
      members: guardiansCount,
      emitted: sectorInvites.length,
      conversions
    };
  };

  const handleOpenCreate = () => {
    setEditingSector(null);
    setName('');
    setActive(true);
    setError(null);
    setSuccess(null);
    setShowForm(true);
  };

  const handleOpenEdit = (sec: Sector) => {
    setEditingSector(sec);
    setName(sec.name);
    setActive(sec.active);
    setError(null);
    setSuccess(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (editingSector) {
        await ApiService.updateSector(editingSector.id, name, active);
        setSuccess('Setor atualizado com sucesso!');
      } else {
        await ApiService.createSector(name);
        setSuccess('Novo setor registrado com sucesso!');
      }
      onRefresh();
      setTimeout(() => setShowForm(false), 1500);
    } catch (err: any) {
      setError(err.message || 'Falha ao registrar setor.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSectorActive = async (sec: Sector) => {
    try {
      const res = await ApiService.updateSector(sec.id, sec.name, !sec.active);
      setSuccess(`Setor ${res.active ? 'ativado' : 'desativado'} com sucesso.`);
      onRefresh();
      setTimeout(() => setSuccess(null), 3500);
    } catch (err: any) {
      setError(err.message || 'Erro ao alternar status do setor.');
    }
  };

  const handleDeleteSector = async (id: string) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setConfirmDeleteId(null);
    try {
      await ApiService.deleteSector(id);
      setSuccess('Setor excluído com sucesso!');
      onRefresh();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir o setor. Verifique se existem colaboradores vinculados.');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="sectors-config-panel" className="space-y-6">
      
      {/* Upper header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-sans font-extrabold text-2xl text-slate-800 dark:text-slate-100 tracking-wide">
            Administração de Setores do Hotel
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Mapeie departamentos que interagem com hóspedes para segmentar rankings e prêmios.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          id="btn-add-sector"
          className="flex items-center space-x-2 bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-600 text-white dark:text-slate-950 px-4 py-2 rounded-xl text-xs font-semibold shadow-sm shrink-0 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Registrar Setor</span>
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-100 text-red-800 rounded-xl text-xs flex items-center space-x-2.5 shadow-sm">
          <AlertCircle className="h-4.5 w-4.5 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-xs flex items-center space-x-2.5 shadow-sm">
          <Check className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* CREATION FORM AND MODAL VIEW */}
      {showForm && (
        <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-inner space-y-4 animate-fade-in max-w-xl">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="font-sans font-bold text-sm text-slate-800 dark:text-slate-100">
              {editingSector ? `Editando Setor: ${editingSector.name}` : 'Cadastrar Novo Setor'}
            </h3>
            <button onClick={() => setShowForm(false)} className="text-xs text-slate-400 hover:text-slate-650 hover:text-slate-300 cursor-pointer">
              Cancelar
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 lg:tracking-wider uppercase">
                Nome do Setor / Departamento
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex Governança, Concierge, SPA..."
                className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-lg text-slate-800 dark:text-slate-100 outline-none"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="rounded border-slate-300 text-amber-500"
                id="checkbox-sector-active"
              />
              <label htmlFor="checkbox-sector-active" className="text-xs text-slate-600 dark:text-slate-300 select-none">
                Departamento Ativo para rankings e criação de guardiões
              </label>
            </div>

            <div className="pt-3 border-t border-slate-205 dark:border-slate-800 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-605 dark:text-slate-300 cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={loading}
                id="btn-save-sector"
                className="bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-600 text-white dark:text-slate-950 px-5 py-2 rounded-lg text-xs font-semibold cursor-pointer"
              >
                {loading ? 'Processando...' : 'Salvar Setor'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SECTORS TABLE LIST */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 space-y-4">
        <h3 className="font-sans font-bold text-sm text-slate-800 dark:text-slate-100">Setores Cadastrados</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sectors.map((sec) => {
            const stats = getSectorStats(sec.id);
            return (
              <div 
                key={sec.id}
                className={`p-4 rounded-xl border flex flex-col justify-between space-y-4 transition-all
                  ${sec.active ? 'bg-slate-50/20 dark:bg-slate-850/40 border-slate-200/60 dark:border-slate-800/80' : 'bg-slate-50 dark:bg-slate-950/40 border-dashed border-slate-200 dark:border-slate-850 opacity-60'}
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <FolderKanban className={`h-4.5 w-4.5 ${sec.active ? 'text-amber-500' : 'text-slate-400'}`} />
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{sec.name}</span>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono tracking-wide uppercase
                    ${sec.active ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}
                  `}>
                    {sec.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-slate-600 dark:text-slate-350 bg-white dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Guardiões</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 font-mono mt-0.5">{stats.members}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Emitidos</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 font-mono mt-0.5">{stats.emitted}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Feedbacks</p>
                    <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">{stats.conversions}</p>
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-2.5 flex justify-end items-center gap-2">
                  {confirmDeleteId === sec.id ? (
                    <div className="flex items-center space-x-1.5 animate-pulse bg-red-50 dark:bg-red-950/20 px-2 py-1 rounded-lg">
                      <span className="text-[10px] text-red-655 text-red-700 dark:text-red-400 font-bold">Confirma exclusão?</span>
                      <button
                        onClick={() => handleDeleteSector(sec.id)}
                        className="bg-red-600 hover:bg-red-700 text-white p-1 px-2.5 rounded text-[10px] uppercase font-bold tracking-wider cursor-pointer"
                      >
                        Sim
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 p-1 px-2.5 rounded text-[10px] uppercase font-bold tracking-wider cursor-pointer"
                      >
                        Não
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => handleOpenEdit(sec)}
                        className="p-1 px-2.5 text-slate-605 text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-slate-800 rounded text-xs shrink-0 flex items-center space-x-1 transition-colors cursor-pointer"
                      >
                        <Edit2 className="h-3 w-3" />
                        <span>Editar</span>
                      </button>
                      
                      <button
                        onClick={() => toggleSectorActive(sec)}
                        className={`p-1 px-2.5 rounded text-xs shrink-0 flex items-center space-x-1 transition-colors cursor-pointer ${sec.active ? 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800' : 'text-emerald-500 hover:bg-emerald-50'}`}
                      >
                        <span>{sec.active ? 'Desativar' : 'Ativar'}</span>
                      </button>

                      <button
                        onClick={() => setConfirmDeleteId(sec.id)}
                        className="p-1 px-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded text-xs shrink-0 flex items-center space-x-1 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Excluir</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
