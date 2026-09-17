import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  X, 
  Folder, 
  Save, 
  User, 
  UserCheck, 
  FileText, 
  Loader2, 
  Calendar, 
  History, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Info,
  Clock
} from 'lucide-react';
import { Client, WorkflowPipeline, WorkflowPhase, TeamMember, FaseGrupoEnum, EtapaColorStatus, ActivityLog } from '../../types';
import { MESES } from './types';
import { cn } from '../../lib/utils';
import { supabase } from '../../lib/supabase';

export interface WorkflowDetailModalProps {
  client: Client;
  grupo: FaseGrupoEnum;
  stepNum: number;
  month: number | null;
  pipe: WorkflowPipeline | null;
  fasesDiagnostico: WorkflowPhase[];
  fasesPlanoAcao: WorkflowPhase[];
  fasesGovernanca: WorkflowPhase[];
  members: TeamMember[];
  path: string;
  notes: string;
  principalId: string;
  backupId: string;
  startDate?: string;
  endDate?: string;
  startAsIs?: string;
  startToBe?: string;
  selectedMemberIds?: string[];
  stepStatus?: EtapaColorStatus;
  selectedYear?: number;
  saving: boolean;
  onClose: () => void;
  onSwitchStep: (stepNum: number) => void;
  onPathChange: (path: string) => void;
  onNotesChange: (notes: string) => void;
  onPrincipalChange: (id: string) => void;
  onBackupChange: (id: string) => void;
  onStartDateChange?: (date: string) => void;
  onEndDateChange?: (date: string) => void;
  onStartAsIsChange?: (date: string) => void;
  onStartToBeChange?: (date: string) => void;
  onSelectedMemberIdsChange?: (ids: string[]) => void;
  onStatusChange?: (status: EtapaColorStatus) => void;
  onSave: () => void;
}

export default function WorkflowDetailModal({
  client,
  grupo,
  stepNum,
  month,
  fasesDiagnostico = [],
  fasesPlanoAcao = [],
  fasesGovernanca = [],
  members = [],
  path,
  notes,
  principalId,
  backupId,
  startDate = '',
  endDate = '',
  startAsIs = '',
  startToBe = '',
  selectedMemberIds = [],
  stepStatus = 'pendente',
  selectedYear,
  saving,
  onClose,
  onSwitchStep,
  onPathChange,
  onNotesChange,
  onPrincipalChange,
  onBackupChange,
  onStartDateChange,
  onEndDateChange,
  onStartAsIsChange,
  onStartToBeChange,
  onSelectedMemberIdsChange,
  onStatusChange,
  onSave
}: WorkflowDetailModalProps) {
  const [activeModalTab, setActiveModalTab] = useState<'detalhes' | 'auditoria'>('detalhes');
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [filterScope, setFilterScope] = useState<'etapa' | 'todos'>('etapa');

  const monthObj = MESES.find(m => m.id === month);
  const currentPhase = grupo === 'fase_1' 
    ? (fasesDiagnostico ? fasesDiagnostico[stepNum - 1] : undefined)
    : grupo === 'fase_2' 
    ? (fasesPlanoAcao ? fasesPlanoAcao[stepNum - 1] : undefined)
    : (fasesGovernanca ? fasesGovernanca[stepNum - 1] : undefined);

  // Carregar logs de auditoria do cliente
  const fetchLogs = useCallback(async () => {
    if (!client?.id) return;
    try {
      setLoadingLogs(true);
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Erro ao buscar logs da etapa:', err);
    } finally {
      setLoadingLogs(false);
    }
  }, [client?.id]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const safeSelectedMemberIds = Array.isArray(selectedMemberIds) ? selectedMemberIds : [];

  const handleToggleMemberSelect = (id: string) => {
    if (!onSelectedMemberIdsChange) return;
    if (safeSelectedMemberIds.includes(id)) {
      onSelectedMemberIdsChange(safeSelectedMemberIds.filter(mId => mId !== id));
    } else {
      onSelectedMemberIdsChange([...safeSelectedMemberIds, id]);
    }
  };

  // Filtragem dos logs para a etapa selecionada
  const filteredLogs = useMemo(() => {
    if (filterScope === 'todos') return logs;

    const phaseName = currentPhase?.nome?.toLowerCase() || '';
    const stepLabel = `etapa ${stepNum}`;

    return logs.filter(log => {
      const titleLower = log.titulo?.toLowerCase() || '';
      const descLower = log.descricao?.toLowerCase() || '';
      const combined = `${titleLower} ${descLower}`;

      // 1. Menção ao nome da etapa ou número da etapa
      if (phaseName && combined.includes(phaseName)) return true;
      if (combined.includes(stepLabel)) return true;

      // 2. Palavras-chave específicas por etapa (Fase 1)
      if (grupo === 'fase_1') {
        if (phaseName.includes('outorga') && (combined.includes('outorga') || combined.includes('sped'))) return true;
        if (phaseName.includes('coleta') && combined.includes('coleta')) return true;
        if (phaseName.includes('as-is') && (combined.includes('as-is') || combined.includes('as is'))) return true;
        if (phaseName.includes('to-be') && (combined.includes('to-be') || combined.includes('to be'))) return true;
        if (combined.includes('diagnóstico')) return true;
      }

      // 3. Fases mensais (Fase 2 / 3)
      if ((grupo === 'fase_2' || grupo === 'fase_3') && month) {
        if (combined.includes(`${month}/${selectedYear || 2026}`) || combined.includes(`mês ${month}`)) return true;
      }

      return false;
    });
  }, [logs, filterScope, currentPhase?.nome, stepNum, grupo, month, selectedYear]);

  // Formatar data do log
  const formatLogDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-xl border border-slate-200 relative flex flex-col gap-4 max-h-[90vh] overflow-y-auto scrollbar-thin"
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cabeçalho do Modal */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn(
              "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border shadow-2xs",
              grupo === 'fase_1' ? "bg-indigo-100 text-indigo-700 border-indigo-200" :
              grupo === 'fase_2' ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-emerald-100 text-emerald-700 border-emerald-200"
            )}>
              {grupo === 'fase_1' ? 'Fase 1 — Diagnóstico' :
               grupo === 'fase_2' ? `Fase 2 — Plano de Ação (${monthObj?.nome || ''})` :
               `Fase 3 — Governança (${monthObj?.nome || ''})`}
            </span>
            {currentPhase && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-900 text-white shadow-2xs">
                Etapa {stepNum}: {currentPhase.nome}
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold text-slate-900 mt-1.5 flex items-center justify-between gap-2">
            <span className="truncate">{client.razao_social}</span>
            {currentPhase && (
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-100 shrink-0">
                {currentPhase.nome}
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure status, cronograma e anotações, ou consulte a trilha de auditoria para <strong className="text-slate-800">"{currentPhase?.nome || `Etapa ${stepNum}`}"</strong>.
          </p>
        </div>

        {/* Seletor de Etapas da Fase */}
        {grupo === 'fase_1' && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 scrollbar-thin">
            {fasesDiagnostico.map((p, idx) => {
              const sNum = idx + 1;
              const isSelected = stepNum === sNum;
              return (
                <button
                  key={p.id || p.key}
                  type="button"
                  onClick={() => onSwitchStep(sNum)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border",
                    isSelected
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  )}
                >
                  <span>{sNum}. {p.nome}</span>
                </button>
              );
            })}
          </div>
        )}

        {grupo === 'fase_2' && (
          <div className="flex gap-1.5 pb-1 border-b border-slate-200">
            {fasesPlanoAcao.map((p, idx) => {
              const sNum = idx + 1;
              const isSelected = stepNum === sNum;
              return (
                <button
                  key={p.id || p.key}
                  type="button"
                  onClick={() => onSwitchStep(sNum)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border",
                    isSelected
                      ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  )}
                >
                  <span>{sNum}. {p.nome}</span>
                </button>
              );
            })}
          </div>
        )}

        {grupo === 'fase_3' && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 scrollbar-thin">
            {fasesGovernanca.map((p, idx) => {
              const sNum = idx + 1;
              const isSelected = stepNum === sNum;
              return (
                <button
                  key={p.id || p.key}
                  type="button"
                  onClick={() => onSwitchStep(sNum)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border",
                    isSelected
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  )}
                >
                  <span>{sNum}. {p.nome}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Abas Internas do Modal: [Detalhes da Etapa] vs [Histórico & Auditoria] */}
        <div className="flex items-center gap-2 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveModalTab('detalhes')}
            className={cn(
              "px-4 py-2 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all cursor-pointer",
              activeModalTab === 'detalhes'
                ? "border-indigo-600 text-indigo-700 bg-indigo-50/50 rounded-t-lg"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Detalhes da Etapa</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModalTab('auditoria')}
            className={cn(
              "px-4 py-2 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all cursor-pointer",
              activeModalTab === 'auditoria'
                ? "border-indigo-600 text-indigo-700 bg-indigo-50/50 rounded-t-lg"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            <History className="w-3.5 h-3.5" />
            <span>Histórico & Auditoria</span>
            {logs.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-700">
                {filteredLogs.length}
              </span>
            )}
          </button>
        </div>

        {/* CONTEÚDO 1: DETALHES DA ETAPA */}
        {activeModalTab === 'detalhes' && (
          <div className="flex flex-col gap-4">
            {/* Seção 0: Status Visual da Etapa */}
            {onStatusChange && (
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-700">Status Visual da Etapa</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => onStatusChange('na')}
                    className={cn(
                      "p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all",
                      stepStatus === 'na'
                        ? "bg-slate-700 text-white border-slate-800 shadow-2xs"
                        : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
                    )}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                    Não se aplica
                  </button>

                  <button
                    type="button"
                    onClick={() => onStatusChange('em_andamento')}
                    className={cn(
                      "p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all",
                      stepStatus === 'em_andamento' || stepStatus === 'amarelo'
                        ? "bg-amber-500 text-white border-amber-600 shadow-2xs"
                        : "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"
                    )}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    Em andamento
                  </button>

                  <button
                    type="button"
                    onClick={() => onStatusChange('concluido')}
                    className={cn(
                      "p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all",
                      stepStatus === 'concluido' || stepStatus === 'verde'
                        ? "bg-emerald-600 text-white border-emerald-700 shadow-2xs"
                        : "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100"
                    )}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    Concluído
                  </button>

                  <button
                    type="button"
                    onClick={() => onStatusChange('pendente')}
                    className={cn(
                      "p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all",
                      stepStatus === 'pendente' || stepStatus === 'cinza'
                        ? "bg-slate-900 text-white border-slate-950 shadow-2xs"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                    Pendente
                  </button>
                </div>
              </div>
            )}

            {/* Seção 1: Datas da Etapa (Item 1 - Cronograma) */}
            <div className="p-3.5 bg-gradient-to-r from-slate-50 to-indigo-50/20 rounded-xl border border-slate-200 flex flex-col gap-3">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                <Calendar className="w-4 h-4 text-indigo-600" />
                Datas da Etapa (Cronograma)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Data Início {selectedYear ? `(${selectedYear})` : ''}
                  </label>
                  <input
                    type="date"
                    min={selectedYear ? `${selectedYear}-01-01` : undefined}
                    max={selectedYear ? `${selectedYear}-12-31` : undefined}
                    value={startDate}
                    onChange={(e) => onStartDateChange && onStartDateChange(e.target.value)}
                    className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-100 outline-none cursor-pointer"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Data Término {selectedYear ? `(${selectedYear})` : ''}
                  </label>
                  <input
                    type="date"
                    min={selectedYear ? `${selectedYear}-01-01` : undefined}
                    max={selectedYear ? `${selectedYear}-12-31` : undefined}
                    value={endDate}
                    onChange={(e) => onEndDateChange && onEndDateChange(e.target.value)}
                    className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-100 outline-none cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Seção 2: Múltiplos Responsáveis (Item 4) */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-600" />
                Múltiplos Responsáveis Indicados (Item 4)
              </label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-white rounded-lg border border-slate-200">
                {members.map((m) => {
                  const isChecked = safeSelectedMemberIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleToggleMemberSelect(m.id)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer border",
                        isChecked
                          ? "bg-indigo-50 text-indigo-700 border-indigo-300 font-semibold"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      <span>{m.nome}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Responsáveis Padrão Principal / Backup */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-600" />
                  Responsável Principal (Padrão)
                </label>
                <select
                  value={principalId}
                  onChange={(e) => onPrincipalChange(e.target.value)}
                  className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-100 outline-none cursor-pointer"
                >
                  <option value="">-- Padrão das Configurações --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome} ({m.cargo})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                  Responsável Backup
                </label>
                <select
                  value={backupId}
                  onChange={(e) => onBackupChange(e.target.value)}
                  className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-100 outline-none cursor-pointer"
                >
                  <option value="">-- Nenhum Backup --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome} ({m.cargo})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Caminho da Rede */}
            <div>
              <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5 mb-1">
                <Folder className="w-4 h-4 text-indigo-600" />
                Caminho da Rede (Pasta do Servidor)
              </label>
              <div className="flex items-center gap-2">
                <input 
                  type="text"
                  value={path}
                  onChange={(e) => onPathChange(e.target.value)}
                  placeholder="Ex: \\servidor\fiscal\empresa\diagnostico"
                  className="flex-1 h-10 px-3 border border-slate-200 rounded-lg text-xs font-mono bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none"
                />
                {path && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(path);
                      alert('Caminho copiado!');
                    }}
                    className="px-3 py-2 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 rounded-lg text-xs font-medium transition-colors border border-slate-200 shrink-0 cursor-pointer"
                  >
                    Copiar
                  </button>
                )}
              </div>
            </div>

            {/* Observações */}
            <div>
              <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5 mb-1">
                <FileText className="w-4 h-4 text-indigo-600" />
                Instruções Livres / Notas de Acompanhamento
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                placeholder="Digite aqui anotações, links úteis, lembretes de auditoria ou pendências..."
                className="w-full p-3 border border-slate-200 rounded-lg text-xs text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none resize-none"
              />
            </div>
          </div>
        )}

        {/* CONTEÚDO 2: HISTÓRICO & AUDITORIA */}
        {activeModalTab === 'auditoria' && (
          <div className="flex flex-col gap-3">
            {/* Barra de Ferramentas de Auditoria */}
            <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilterScope('etapa')}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border",
                    filterScope === 'etapa'
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                  )}
                >
                  Desta Etapa ({currentPhase?.nome ? currentPhase.nome.split(' ')[0] : `Etapa ${stepNum}`})
                </button>

                <button
                  type="button"
                  onClick={() => setFilterScope('todos')}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border",
                    filterScope === 'todos'
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                  )}
                >
                  Todos da Empresa ({logs.length})
                </button>
              </div>

              <button
                type="button"
                onClick={fetchLogs}
                disabled={loadingLogs}
                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200 cursor-pointer"
                title="Recarregar Histórico"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", loadingLogs && "animate-spin text-indigo-600")} />
              </button>
            </div>

            {/* Lista de Registros de Auditoria */}
            <div className="flex flex-col gap-2.5 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin">
              {loadingLogs ? (
                <div className="flex flex-col items-center justify-center p-8 text-slate-400 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                  <span className="text-xs">Consultando histórico de auditoria...</span>
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 flex flex-col items-center gap-2">
                  <History className="w-8 h-8 text-slate-300" />
                  <p className="text-xs font-semibold text-slate-600">
                    Nenhum registro específico encontrado para esta etapa.
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-sm">
                    Clique em <strong>"Todos da Empresa"</strong> acima para visualizar todo o histórico de logs gerais e marcos do cliente.
                  </p>
                </div>
              ) : (
                filteredLogs.map((log) => {
                  const isSuccess = log.tipo_log === 'success';
                  const isError = log.tipo_log === 'error';
                  const isSync = log.tipo_log === 'sync';

                  return (
                    <div 
                      key={log.id} 
                      className="p-3 bg-white hover:bg-slate-50/80 rounded-xl border border-slate-200 flex flex-col gap-1.5 transition-all shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        {/* Usuário Responsável */}
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] border border-indigo-200">
                            {log.usuario_nome ? log.usuario_nome.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <span className="text-xs font-bold text-slate-800">
                            {log.usuario_nome || 'Usuário do Sistema'}
                          </span>
                        </div>

                        {/* Data e Hora */}
                        <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{formatLogDate(log.created_at)}</span>
                        </div>
                      </div>

                      {/* Título do Log */}
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {isSuccess ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : isError ? (
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        ) : isSync ? (
                          <RefreshCw className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        ) : (
                          <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        )}
                        <strong className="text-xs text-slate-900">{log.titulo}</strong>
                      </div>

                      {/* Descrição Detalhada */}
                      <p className="text-[11px] text-slate-600 pl-5 leading-relaxed">
                        {log.descricao}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Rodapé do Modal */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            {activeModalTab === 'auditoria' ? 'Fechar' : 'Cancelar'}
          </button>
          {activeModalTab === 'detalhes' && (
            <button
              type="button"
              disabled={saving}
              onClick={onSave}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-700 text-white rounded-lg text-xs font-semibold hover:bg-indigo-800 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Alterações
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
