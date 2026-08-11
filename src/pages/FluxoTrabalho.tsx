import React, { useState, useEffect, useMemo } from 'react';
import { GitMerge, Check, Hourglass, Lock, Info, ArrowRight, ArrowLeft, PlayCircle, Loader2, X, AlertTriangle, Folder, Copy, Pencil, Save, User, FileText, BarChart3, ChevronRight, Building2, TrendingUp, Clock, Plus, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/logger';
import { useAuth } from '../contexts/AuthContext';
import { WorkflowPipeline, Client, PipelineStatusEnum, FiscalDocumentMatrix, WorkflowAssignment, FaseEnum, WorkflowPhase } from '../types';
import { cn } from '../lib/utils';

const DEFAULT_STEPS = [
  { key: 'coleta_arquivos', nome: 'Arquivos', ordem: 1 },
  { key: 'calculadora_rtc', nome: 'Calculadora RTC', ordem: 2 },
  { key: 'compliance_rtc', nome: 'Compliance RTC', ordem: 3 },
  { key: 'apuracao_assistida', nome: 'Apuração Assistida', ordem: 4 },
  { key: 'entrega_apresentacao', nome: 'Entrega e Apresentação', ordem: 5 },
];

const MESES = [
  { id: 1, nome: 'Janeiro', sigla: 'Jan' },
  { id: 2, nome: 'Fevereiro', sigla: 'Fev' },
  { id: 3, nome: 'Março', sigla: 'Mar' },
  { id: 4, nome: 'Abril', sigla: 'Abr' },
  { id: 5, nome: 'Maio', sigla: 'Mai' },
  { id: 6, nome: 'Junho', sigla: 'Jun' },
  { id: 7, nome: 'Julho', sigla: 'Jul' },
  { id: 8, nome: 'Agosto', sigla: 'Ago' },
  { id: 9, nome: 'Setembro', sigla: 'Set' },
  { id: 10, nome: 'Outubro', sigla: 'Out' },
  { id: 11, nome: 'Novembro', sigla: 'Nov' },
  { id: 12, nome: 'Dezembro', sigla: 'Dez' },
];

// ────────────────────────────────────────────────
// Tipo auxiliar: Grupo de pipelines por empresa
// ────────────────────────────────────────────────
interface ClientGroup {
  clientId: string;
  client: Client;
  pipelines: WorkflowPipeline[];
  total: number;
  concluidos: number;
  emAndamento: number;
  iniciados: number;
  bloqueados: number;
  progressPercent: number;
}

export default function FluxoTrabalho() {
  const { getUserName } = useAuth();
  const [pipelines, setPipelines] = useState<WorkflowPipeline[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [completeChecklists, setCompleteChecklists] = useState<FiscalDocumentMatrix[]>([]);
  const [assignments, setAssignments] = useState<WorkflowAssignment[]>([]);
  const [phases, setPhases] = useState<WorkflowPhase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Modal Nova Esteira
  const [selectedClientId, setSelectedClientId] = useState('');
  const [anoReferencia, setAnoReferencia] = useState<number>(2023);
  const [mesReferencia, setMesReferencia] = useState<number>(1);
  const [caminhoRedeEtapa1, setCaminhoRedeEtapa1] = useState('');
  const [mensagemInfo, setMensagemInfo] = useState('Pronto para iniciar a coleta de dados de faturamento.');

  // Modal Detalhes da Etapa
  const [detailModalPipe, setDetailModalPipe] = useState<WorkflowPipeline | null>(null);
  const [detailModalStepNum, setDetailModalStepNum] = useState<number | null>(null);
  const [detailModalPath, setDetailModalPath] = useState<string>('');
  const [detailModalNotes, setDetailModalNotes] = useState<string>('');
  const [savingDetail, setSavingDetail] = useState(false);

  // Modal Visão Analítica
  const [analyticGroup, setAnalyticGroup] = useState<ClientGroup | null>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // ────────────────────────────────────────────────
  // Fetch de dados
  // ────────────────────────────────────────────────
  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: phasesData, error: phaseErr } = await supabase
        .from('workflow_phases')
        .select('*')
        .order('ordem', { ascending: true });

      if (phaseErr) console.error('Erro ao buscar fases:', phaseErr);
      const activePhases = (phasesData && phasesData.length > 0)
        ? phasesData
        : DEFAULT_STEPS.map(s => ({ id: s.key, key: s.key, nome: s.nome, ordem: s.ordem }));
      
      setPhases(activePhases);

      const { data: clientsData, error: clientErr } = await supabase
        .from('clients')
        .select('*')
        .order('razao_social');

      if (clientErr) throw clientErr;
      setClients(clientsData || []);

      const { data: matrixData, error: matrixErr } = await supabase
        .from('fiscal_documents_matrix')
        .select('*, clients(*)')
        .eq('status_geral', 'completo');

      if (matrixErr) console.error('Erro ao carregar checklists:', matrixErr);
      setCompleteChecklists(matrixData || []);

      const { data: assignData, error: assErr } = await supabase
        .from('workflow_assignments')
        .select('*, responsavel_principal:team_members!responsavel_principal_id(*), responsavel_backup:team_members!responsavel_backup_id(*)');

      if (assErr) console.error('Erro ao carregar responsáveis:', assErr);
      setAssignments(assignData || []);

      const { data: pipeData, error: pipeErr } = await supabase
        .from('workflow_pipelines')
        .select('*, clients(*)')
        .order('created_at', { ascending: false });

      if (pipeErr) throw pipeErr;
      setPipelines(pipeData || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Erro ao carregar pipelines:', message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalSteps = phases.length || 5;

  // ────────────────────────────────────────────────
  // Agrupamento de pipelines por empresa (Visão Sintética)
  // ────────────────────────────────────────────────
  const clientGroups: ClientGroup[] = useMemo(() => {
    const groupMap = new Map<string, WorkflowPipeline[]>();

    for (const pipe of pipelines) {
      const key = pipe.client_id;
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(pipe);
    }

    const groups: ClientGroup[] = [];
    for (const [clientId, clientPipelines] of groupMap) {
      const client = clientPipelines[0]?.clients || clients.find(c => c.id === clientId);
      const total = clientPipelines.length;
      const concluidos = clientPipelines.filter(p => p.status === 'concluido').length;
      const emAndamento = clientPipelines.filter(p => p.status === 'em_andamento').length;
      const iniciados = clientPipelines.filter(p => p.status === 'iniciado').length;
      const bloqueados = clientPipelines.filter(p => p.status === 'bloqueado').length;
      const progressPercent = total > 0 ? Math.round((concluidos / total) * 100) : 0;

      // Ordenar pipelines por ano e mês (mais recente primeiro)
      const sorted = [...clientPipelines].sort((a, b) => {
        if (a.ano_referencia !== b.ano_referencia) return b.ano_referencia - a.ano_referencia;
        return (b.mes_referencia || 0) - (a.mes_referencia || 0);
      });

      if (client) {
        groups.push({
          clientId,
          client: client as Client,
          pipelines: sorted,
          total,
          concluidos,
          emAndamento,
          iniciados,
          bloqueados,
          progressPercent,
        });
      }
    }

    // Ordenar grupos por nome da empresa
    return groups.sort((a, b) => (a.client.razao_social || '').localeCompare(b.client.razao_social || ''));
  }, [pipelines, clients]);

  // ────────────────────────────────────────────────
  // Filtros para modal Nova Esteira
  // ────────────────────────────────────────────────
  const clientsWithCompleteChecklist = clients.filter(client =>
    completeChecklists.some(c => c.client_id === client.id)
  );

  const availablePeriodsForClient = completeChecklists.filter(c => c.client_id === selectedClientId);

  // ────────────────────────────────────────────────
  // Handlers
  // ────────────────────────────────────────────────
  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId);
    const periods = completeChecklists.filter(c => c.client_id === clientId);
    if (periods.length > 0) {
      setAnoReferencia(periods[0].ano_base);
      setMesReferencia(periods[0].mes_base);
    }
  };

  const handlePeriodChange = (value: string) => {
    const [ano, mes] = value.split('-').map(Number);
    if (ano && mes) {
      setAnoReferencia(ano);
      setMesReferencia(mes);
    }
  };

  const handleCreatePipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || !anoReferencia || !mesReferencia) {
      alert('Selecione um cliente e um período com checklist completo.');
      return;
    }

    try {
      const initialPaths: Record<string, string> = {};
      if (caminhoRedeEtapa1) {
        initialPaths['1'] = caminhoRedeEtapa1;
      }

      const clientObj = clients.find(c => c.id === selectedClientId);

      const { error: insErr } = await supabase
        .from('workflow_pipelines')
        .insert({
          client_id: selectedClientId,
          status: 'iniciado',
          etapa_atual: 1,
          mensagem_info: mensagemInfo,
          caminho_rede: caminhoRedeEtapa1 || null,
          caminhos_rede_etapas: initialPaths,
          ano_referencia: anoReferencia,
          mes_referencia: mesReferencia
        });

      if (insErr) throw insErr;

      await logActivity({
        titulo: 'Nova Esteira Iniciada',
        descricao: `Nova esteira criada para ${clientObj?.razao_social || 'Cliente'} (Período: Mês ${mesReferencia}/${anoReferencia})`,
        tipo_log: 'success',
        client_id: selectedClientId,
        usuario_nome: getUserName()
      });

      setShowModal(false);
      setSelectedClientId('');
      setCaminhoRedeEtapa1('');
      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert('Erro ao criar esteira: ' + message);
    }
  };

  const handleAdvanceStep = async (pipe: WorkflowPipeline) => {
    try {
      const stepNames = phases.map(p => p.nome);
      let nextStep = pipe.etapa_atual + 1;
      let nextStatus: PipelineStatusEnum = 'em_andamento';
      let nextMessage = `Em andamento na etapa ${nextStep}: ${stepNames[nextStep - 1] || ''}`;

      if (nextStep > totalSteps) {
        nextStep = totalSteps;
        nextStatus = 'concluido';
        nextMessage = 'Esteira finalizada com sucesso.';
      }

      const { error: upErr } = await supabase
        .from('workflow_pipelines')
        .update({
          etapa_atual: nextStep,
          status: nextStatus,
          mensagem_info: nextMessage,
          updated_at: new Date().toISOString()
        })
        .eq('id', pipe.id);

      if (upErr) throw upErr;

      const clientName = pipe.clients?.razao_social || 'Cliente';
      await logActivity({
        titulo: 'Avanço de Etapa',
        descricao: `Esteira de ${clientName} avançou para a etapa ${nextStep}: ${stepNames[nextStep - 1] || ''}`,
        tipo_log: 'info',
        client_id: pipe.client_id,
        usuario_nome: getUserName()
      });

      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert('Erro ao avançar etapa: ' + message);
    }
  };

  const handleRegressStep = async (pipe: WorkflowPipeline) => {
    if (pipe.etapa_atual <= 1) return;
    try {
      const stepNames = phases.map(p => p.nome);
      const prevStep = pipe.etapa_atual - 1;
      const prevStatus: PipelineStatusEnum = prevStep === 1 ? 'iniciado' : 'em_andamento';
      const prevMessage = `Retornado para a etapa ${prevStep}: ${stepNames[prevStep - 1] || ''}`;

      const { error: upErr } = await supabase
        .from('workflow_pipelines')
        .update({
          etapa_atual: prevStep,
          status: prevStatus,
          mensagem_info: prevMessage,
          updated_at: new Date().toISOString()
        })
        .eq('id', pipe.id);

      if (upErr) throw upErr;

      const clientName = pipe.clients?.razao_social || 'Cliente';
      await logActivity({
        titulo: 'Retorno de Etapa',
        descricao: `Esteira de ${clientName} retornou para a etapa ${prevStep}: ${stepNames[prevStep - 1] || ''}`,
        tipo_log: 'sync',
        client_id: pipe.client_id,
        usuario_nome: getUserName()
      });

      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert('Erro ao retornar etapa: ' + message);
    }
  };

  const getStepPath = (pipe: WorkflowPipeline, stepNum: number): string => {
    if (pipe.caminhos_rede_etapas && pipe.caminhos_rede_etapas[String(stepNum)]) {
      return pipe.caminhos_rede_etapas[String(stepNum)];
    }
    if (stepNum === 1 && pipe.caminho_rede) return pipe.caminho_rede;
    return '';
  };

  const getStepNotes = (pipe: WorkflowPipeline, stepNum: number): string => {
    if (pipe.observacoes_etapas && pipe.observacoes_etapas[String(stepNum)]) {
      return pipe.observacoes_etapas[String(stepNum)];
    }
    return '';
  };

  const openDetailModal = (pipe: WorkflowPipeline, stepNum?: number) => {
    const initialStep = stepNum || pipe.etapa_atual || 1;
    setDetailModalPipe(pipe);
    setDetailModalStepNum(initialStep);
    setDetailModalPath(getStepPath(pipe, initialStep));
    setDetailModalNotes(getStepNotes(pipe, initialStep));
  };

  const handleSwitchDetailStep = (stepNum: number) => {
    if (!detailModalPipe) return;
    setDetailModalStepNum(stepNum);
    setDetailModalPath(getStepPath(detailModalPipe, stepNum));
    setDetailModalNotes(getStepNotes(detailModalPipe, stepNum));
  };

  const handleSaveDetail = async () => {
    if (!detailModalPipe || !detailModalStepNum) return;
    try {
      setSavingDetail(true);
      const stepNumStr = String(detailModalStepNum);

      const currentPaths = detailModalPipe.caminhos_rede_etapas || {};
      const updatedPaths = { ...currentPaths, [stepNumStr]: detailModalPath };

      const currentNotes = detailModalPipe.observacoes_etapas || {};
      const updatedNotes = { ...currentNotes, [stepNumStr]: detailModalNotes };

      const { error: upErr } = await supabase
        .from('workflow_pipelines')
        .update({
          caminhos_rede_etapas: updatedPaths,
          observacoes_etapas: updatedNotes,
          caminho_rede: detailModalStepNum === 1 ? detailModalPath : (detailModalPipe.caminho_rede || detailModalPath),
          updated_at: new Date().toISOString()
        })
        .eq('id', detailModalPipe.id);

      if (upErr) throw upErr;

      const stepName = phases[detailModalStepNum - 1]?.nome || `Etapa ${detailModalStepNum}`;
      const clientName = detailModalPipe.clients?.razao_social || 'Cliente';

      await logActivity({
        titulo: 'Detalhes da Etapa Atualizados',
        descricao: `Caminho da rede e observações atualizados para a etapa ${detailModalStepNum} (${stepName}) de ${clientName}`,
        tipo_log: 'info',
        client_id: detailModalPipe.client_id,
        usuario_nome: getUserName()
      });

      setDetailModalPipe(null);
      setDetailModalStepNum(null);
      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert('Erro ao salvar detalhes da etapa: ' + message);
    } finally {
      setSavingDetail(false);
    }
  };

  const handleCopyStepPath = (path: string, key: string) => {
    navigator.clipboard.writeText(path);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getInitials = (name?: string) => {
    if (!name) return 'CL';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const getStepAssignment = (stepNum: number) => {
    const phaseObj = phases[stepNum - 1];
    if (!phaseObj) return undefined;
    return assignments.find(a => a.fase_fluxo === phaseObj.key);
  };

  // Abrir modal analítico para uma empresa
  const openAnalyticModal = (group: ClientGroup) => {
    setAnalyticGroup(group);
  };

  // Abrir modal Nova Esteira pré-selecionando o cliente (a partir do analítico)
  const openNewPipelineFromAnalytic = (clientId: string) => {
    setAnalyticGroup(null);
    handleClientChange(clientId);
    setShowModal(true);
  };

  // Períodos completos do checklist que AINDA NÃO têm pipeline criado para um dado client
  const getUnusedPeriodsForClient = (clientId: string): FiscalDocumentMatrix[] => {
    const clientPipelines = pipelines.filter(p => p.client_id === clientId);
    return completeChecklists.filter(c => {
      if (c.client_id !== clientId) return false;
      return !clientPipelines.some(
        p => p.ano_referencia === c.ano_base && p.mes_referencia === c.mes_base
      );
    });
  };

  // ────────────────────────────────────────────────
  // Sub-componente: Timeline compacta de etapas (reutilizado no modal analítico)
  // ────────────────────────────────────────────────
  const PipelineTimeline = ({ pipe, compact = false }: { pipe: WorkflowPipeline; compact?: boolean }) => {
    const isConcluido = pipe.status === 'concluido';
    const isEmAndamento = pipe.status === 'em_andamento';

    return (
      <div className={cn("relative w-full", compact ? "py-1" : "py-1.5 my-1")}>
        {/* Linha de fundo */}
        <div className="absolute top-[16px] left-4 right-4 h-1 bg-slate-100 -translate-y-1/2 z-0 rounded-full"></div>
        {/* Linha de progresso */}
        <div 
          className={cn(
            "absolute top-[16px] left-4 h-1 -translate-y-1/2 z-0 rounded-full transition-all duration-500",
            isConcluido ? "bg-emerald-500" : "bg-indigo-600"
          )}
          style={{
            width: isConcluido 
              ? 'calc(100% - 2rem)' 
              : `calc(${Math.round(((pipe.etapa_atual - 1) / Math.max(1, phases.length - 1)) * 100)}% * 0.9 + 5%)`
          }}
        ></div>
        
        <div 
          className="grid gap-2 relative z-10 w-full px-2"
          style={{ gridTemplateColumns: `repeat(${phases.length}, minmax(0, 1fr))` }}
        >
          {phases.map((phaseObj, index) => {
            const stepNum = index + 1;
            const stepName = phaseObj.nome;
            const isCompleted = stepNum < pipe.etapa_atual || isConcluido;
            const isCurrent = stepNum === pipe.etapa_atual && !isConcluido;
            const isLocked = stepNum > pipe.etapa_atual;
            const assign = getStepAssignment(stepNum);
            const principalName = assign?.responsavel_principal?.nome;
            const backupName = assign?.responsavel_backup?.nome;

            return (
              <div key={index} className={cn("flex flex-col items-center gap-1 transition-opacity", isLocked && "opacity-60")}>
                {/* Círculo do Ícone */}
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center shadow-xs relative transition-all shrink-0",
                  isCompleted ? "bg-emerald-500 text-white" :
                  isCurrent ? "bg-white border-2 border-indigo-600 shadow-md ring-3 ring-indigo-50" :
                  "bg-slate-100 border border-slate-200"
                )}>
                  {isCompleted && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                  {isCurrent && isEmAndamento && <Hourglass className="w-3.5 h-3.5 text-indigo-600 animate-spin" />}
                  {isCurrent && !isEmAndamento && <PlayCircle className="w-3.5 h-3.5 text-indigo-600" />}
                  {isLocked && <Lock className="w-3 h-3 text-slate-400" />}
                </div>

                {/* Nome da Etapa */}
                <span className={cn(
                  "text-[10px] font-medium text-center leading-tight mt-0.5",
                  isCurrent ? "text-indigo-700 font-bold" : "text-slate-700"
                )}>
                  {stepName}
                </span>

                {/* Responsáveis */}
                {!compact && (
                  <div className="w-full flex flex-col items-center gap-0 text-[10px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100 mt-0.5">
                    {principalName ? (
                      <span className={cn("flex items-center gap-1 font-medium truncate max-w-[110px]", isCurrent ? "text-indigo-900 font-semibold" : "text-slate-700")} title={`Responsável Principal: ${principalName}`}>
                        <User className="w-2.5 h-2.5 text-indigo-600 shrink-0" />
                        {principalName.split(' ')[0]}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic text-[9px]">Sem resp.</span>
                    )}
                    {backupName && (
                      <span className="text-[9px] text-slate-400 truncate max-w-[100px]" title={`Backup: ${backupName}`}>
                        (Bk: {backupName.split(' ')[0]})
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ────────────────────────────────────────────────
  // Sub-componente: Badge de status
  // ────────────────────────────────────────────────
  const StatusBadge = ({ status }: { status: PipelineStatusEnum }) => {
    const isConcluido = status === 'concluido';
    const isEmAndamento = status === 'em_andamento';
    return (
      <span className={cn(
        "px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1 capitalize whitespace-nowrap",
        isConcluido ? "bg-emerald-100 text-emerald-700" :
        isEmAndamento ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
      )}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  // ────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────
  return (
    <div className="flex flex-col w-full gap-8 relative p-2">
      {/* Header */}
      <div className="flex flex-row justify-between items-end pb-4 border-b border-slate-200/50">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-slate-900">Fluxo de Trabalho</h1>
          <p className="text-slate-600 text-base max-w-2xl">
            Acompanhe o progresso de cada empresa através do pipeline de conformidade — visão sintética por empresa.
          </p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => {
              setShowModal(true);
              if (clientsWithCompleteChecklist.length > 0 && !selectedClientId) {
                handleClientChange(clientsWithCompleteChecklist[0].id);
              }
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-700 rounded-full hover:bg-indigo-800 hover:shadow-md transition-all text-white shadow-sm cursor-pointer"
          >
            <GitMerge className="w-4 h-4" />
            <span className="text-sm font-medium">Nova Esteira</span>
          </button>
        </div>
      </div>

      {/* Conteúdo Principal */}
      {loading ? (
        <div className="flex items-center justify-center p-12 text-slate-500 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          Carregando fluxos de trabalho...
        </div>
      ) : clientGroups.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-500 shadow-sm border border-slate-200">
          Nenhuma esteira de trabalho cadastrada no momento. Clique em "Nova Esteira" acima para iniciar.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {/* ──────── VISÃO SINTÉTICA: 1 Card por Empresa ──────── */}
          {clientGroups.map((group) => {
            const initials = getInitials(group.client.razao_social);
            const hasAllConcluido = group.total > 0 && group.concluidos === group.total;

            return (
              <div 
                key={group.clientId} 
                className={cn(
                  "bg-white rounded-2xl shadow-sm border border-slate-200 p-5 relative overflow-hidden group hover:shadow-lg transition-all duration-300 flex flex-col gap-4",
                  hasAllConcluido && "border-emerald-200"
                )}
              >
                {/* Barra lateral de status */}
                {hasAllConcluido && <div className="absolute top-0 right-0 w-1.5 h-full bg-emerald-500"></div>}
                {group.emAndamento > 0 && !hasAllConcluido && <div className="absolute top-0 right-0 w-1.5 h-full bg-amber-400"></div>}

                {/* Cabeçalho: Avatar + Nome + CNPJ */}
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center shadow-xs border border-indigo-200/50 shrink-0">
                    <span className="text-lg font-bold text-indigo-700">{initials}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-slate-900 truncate group-hover:text-indigo-700 transition-colors leading-tight">
                      {group.client.razao_social}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      CNPJ: {group.client.cnpj || '-'}
                    </p>
                  </div>
                </div>

                {/* Indicadores Resumidos */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="flex flex-col items-center bg-slate-50 rounded-xl px-2 py-2 border border-slate-100">
                    <span className="text-lg font-bold text-slate-800">{group.total}</span>
                    <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Total</span>
                  </div>
                  <div className="flex flex-col items-center bg-emerald-50 rounded-xl px-2 py-2 border border-emerald-100">
                    <span className="text-lg font-bold text-emerald-700">{group.concluidos}</span>
                    <span className="text-[9px] font-medium text-emerald-600 uppercase tracking-wider">Concluído</span>
                  </div>
                  <div className="flex flex-col items-center bg-amber-50 rounded-xl px-2 py-2 border border-amber-100">
                    <span className="text-lg font-bold text-amber-700">{group.emAndamento}</span>
                    <span className="text-[9px] font-medium text-amber-600 uppercase tracking-wider">Andamento</span>
                  </div>
                  <div className="flex flex-col items-center bg-blue-50 rounded-xl px-2 py-2 border border-blue-100">
                    <span className="text-lg font-bold text-blue-700">{group.iniciados}</span>
                    <span className="text-[9px] font-medium text-blue-600 uppercase tracking-wider">Iniciado</span>
                  </div>
                </div>

                {/* Barra de Progresso Geral */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Progresso Geral</span>
                    <span className={cn(
                      "font-bold",
                      group.progressPercent === 100 ? "text-emerald-700" : "text-indigo-700"
                    )}>
                      {group.progressPercent}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-700 ease-out",
                        group.progressPercent === 100 ? "bg-emerald-500" : "bg-indigo-600"
                      )}
                      style={{ width: `${group.progressPercent}%` }}
                    ></div>
                  </div>
                </div>

                {/* Botão Visão Analítica */}
                <button
                  onClick={() => openAnalyticModal(group)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 hover:border-indigo-300 rounded-xl text-sm font-semibold text-indigo-700 transition-all cursor-pointer shadow-2xs group/btn"
                >
                  <Eye className="w-4 h-4 text-indigo-600 group-hover/btn:scale-110 transition-transform" />
                  Visão Analítica
                  <ChevronRight className="w-4 h-4 text-indigo-400 group-hover/btn:translate-x-0.5 transition-transform" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ──────── MODAL VISÃO ANALÍTICA ──────── */}
      {analyticGroup && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] shadow-2xl border border-slate-200 relative flex flex-col overflow-hidden">
            {/* Header do Modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-indigo-50/50 to-white shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center shadow-xs border border-indigo-200/50">
                  <span className="text-base font-bold text-indigo-700">{getInitials(analyticGroup.client.razao_social)}</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{analyticGroup.client.razao_social}</h3>
                  <p className="text-xs text-slate-500 font-mono">
                    CNPJ: {analyticGroup.client.cnpj || '-'} • {analyticGroup.total} esteira{analyticGroup.total !== 1 ? 's' : ''} registrada{analyticGroup.total !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Botão nova esteira a partir do analítico */}
                {getUnusedPeriodsForClient(analyticGroup.clientId).length > 0 && (
                  <button
                    onClick={() => openNewPipelineFromAnalytic(analyticGroup.clientId)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-700 text-white rounded-xl text-xs font-semibold hover:bg-indigo-800 transition-colors shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Nova Esteira
                  </button>
                )}
                <button 
                  onClick={() => setAnalyticGroup(null)} 
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Indicadores resumidos no topo do modal */}
            <div className="flex items-center gap-4 px-6 py-3 bg-slate-50/50 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                <span className="font-medium">{analyticGroup.concluidos} Concluído{analyticGroup.concluidos !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                <span className="font-medium">{analyticGroup.emAndamento} Em Andamento</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-400"></div>
                <span className="font-medium">{analyticGroup.iniciados} Iniciado{analyticGroup.iniciados !== 1 ? 's' : ''}</span>
              </div>
            </div>

            {/* Lista de Pipelines (scrollable) */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="flex flex-col gap-4">
                {analyticGroup.pipelines.map((pipe) => {
                  const mesObj = MESES.find(m => m.id === (pipe.mes_referencia || 1));
                  const periodLabel = `${mesObj?.nome || 'Mês ' + (pipe.mes_referencia || 1)} / ${pipe.ano_referencia}`;
                  const isConcluido = pipe.status === 'concluido';
                  const isEmAndamento = pipe.status === 'em_andamento';

                  return (
                    <div 
                      key={pipe.id} 
                      className={cn(
                        "bg-white rounded-xl border p-4 relative overflow-hidden hover:shadow-md transition-shadow duration-200",
                        isConcluido ? "border-emerald-200 bg-emerald-50/30" :
                        isEmAndamento ? "border-amber-200 bg-amber-50/20" : "border-slate-200"
                      )}
                    >
                      {/* Cabeçalho do período */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                            isConcluido ? "bg-emerald-100" :
                            isEmAndamento ? "bg-amber-100" : "bg-indigo-50"
                          )}>
                            {isConcluido ? <Check className="w-4 h-4 text-emerald-600 stroke-[3]" /> :
                             isEmAndamento ? <Clock className="w-4 h-4 text-amber-600" /> :
                             <PlayCircle className="w-4 h-4 text-indigo-600" />}
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-slate-800">{periodLabel}</h4>
                            <p className="text-[11px] text-slate-500">
                              Etapa {pipe.etapa_atual} de {phases.length} • {pipe.mensagem_info || 'Sem informações'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openDetailModal(pipe, pipe.etapa_atual)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-300 border border-indigo-200 rounded-xl text-[11px] font-semibold text-indigo-700 transition-all cursor-pointer shadow-2xs"
                          >
                            <FileText className="w-3.5 h-3.5 text-indigo-600" />
                            Detalhe
                          </button>
                          <StatusBadge status={pipe.status} />
                        </div>
                      </div>

                      {/* Timeline de Etapas */}
                      <PipelineTimeline pipe={pipe} compact />

                      {/* Ações: Voltar / Avançar */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex justify-end items-center gap-2">
                        {pipe.etapa_atual > 1 && (
                          <button 
                            onClick={() => handleRegressStep(pipe)}
                            className="text-[11px] font-semibold text-slate-700 hover:text-slate-900 transition-colors flex items-center gap-1 border border-slate-200 px-3 py-1 rounded-lg hover:bg-slate-100 cursor-pointer shadow-2xs"
                          >
                            <ArrowLeft className="w-3 h-3" /> Voltar
                          </button>
                        )}
                        {!isConcluido && (
                          <button 
                            onClick={() => handleAdvanceStep(pipe)}
                            className="text-[11px] font-semibold text-white bg-indigo-700 hover:bg-indigo-800 transition-colors flex items-center gap-1 px-3.5 py-1 rounded-lg cursor-pointer shadow-2xs"
                          >
                            Avançar <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Períodos disponíveis sem pipeline */}
                {(() => {
                  const unusedPeriods = getUnusedPeriodsForClient(analyticGroup.clientId);
                  if (unusedPeriods.length === 0) return null;
                  return (
                    <div className="mt-2 p-4 bg-blue-50/50 border border-blue-200 border-dashed rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <Info className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="text-xs font-semibold text-blue-800">
                          {unusedPeriods.length} período{unusedPeriods.length !== 1 ? 's' : ''} com checklist completo sem esteira criada
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {unusedPeriods.map(p => {
                          const mObj = MESES.find(m => m.id === p.mes_base);
                          return (
                            <span key={`${p.ano_base}-${p.mes_base}`} className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg text-[11px] font-medium">
                              {mObj?.sigla || `M${p.mes_base}`}/{p.ano_base}
                            </span>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => openNewPipelineFromAnalytic(analyticGroup.clientId)}
                        className="mt-3 flex items-center gap-1.5 px-4 py-2 bg-indigo-700 text-white rounded-xl text-xs font-semibold hover:bg-indigo-800 transition-colors shadow-xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Criar Nova Esteira
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────── MODAL NOVA ESTEIRA ──────── */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-slate-200 relative">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Nova Esteira de Trabalho</h3>
            <p className="text-xs text-slate-500 mb-4">
              Selecione o cliente e o período cujo checklist fiscal foi concluído com sucesso.
            </p>

            {clientsWithCompleteChecklist.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-800 text-xs leading-relaxed mb-4">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-900">Nenhum checklist completo encontrado</p>
                  <p className="mt-1">
                    Para iniciar uma esteira de trabalho, acesse o módulo <strong>Checklist Fiscal</strong> e certifique-se de que todos os documentos de ao menos um período estejam marcados como entregues/conformes.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreatePipeline} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-600">Cliente (Com Checklist Completo)</label>
                  <select 
                    value={selectedClientId} 
                    onChange={(e) => handleClientChange(e.target.value)}
                    required
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-indigo-100 outline-none"
                  >
                    <option value="" disabled>Escolha um cliente habilitado</option>
                    {clientsWithCompleteChecklist.map(c => (
                      <option key={c.id} value={c.id}>{c.razao_social} ({c.cnpj})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600">Período Completo (Mês / Ano)</label>
                  <select 
                    value={`${anoReferencia}-${mesReferencia}`}
                    onChange={(e) => handlePeriodChange(e.target.value)}
                    required
                    disabled={!selectedClientId}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-indigo-100 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {availablePeriodsForClient.length === 0 ? (
                      <option value="">Nenhum período completo para este cliente</option>
                    ) : (
                      availablePeriodsForClient.map(p => {
                        const mObj = MESES.find(m => m.id === p.mes_base);
                        return (
                          <option key={`${p.ano_base}-${p.mes_base}`} value={`${p.ano_base}-${p.mes_base}`}>
                            {mObj?.nome || `Mês ${p.mes_base}`} / {p.ano_base} (Status: Completo)
                          </option>
                        );
                      })
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600">Pasta da Etapa 1 (Arquivos) - Opcional</label>
                  <input 
                    type="text"
                    value={caminhoRedeEtapa1}
                    onChange={(e) => setCaminhoRedeEtapa1(e.target.value)}
                    placeholder="Ex: \\servidor\fiscal\2023\01_Arquivos"
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-indigo-100 outline-none font-mono placeholder:font-sans"
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={!selectedClientId || availablePeriodsForClient.length === 0}
                  className="mt-2 w-full h-10 bg-indigo-700 text-white rounded-lg text-sm font-medium hover:bg-indigo-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  Criar Fluxo de Trabalho
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ──────── MODAL DETALHES DA ESTEIRA ──────── */}
      {detailModalPipe && detailModalStepNum && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-xl border border-slate-200 relative flex flex-col gap-5">
            <button 
              onClick={() => {
                setDetailModalPipe(null);
                setDetailModalStepNum(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Detalhes da Esteira de Trabalho
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Cliente: <strong className="text-slate-700">{detailModalPipe.clients?.razao_social}</strong> | Período: <strong className="text-indigo-600">Mês {detailModalPipe.mes_referencia}/{detailModalPipe.ano_referencia}</strong>
              </p>
            </div>

            {/* Abas para selecionar qualquer Etapa do Fluxo */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 scrollbar-thin">
              {phases.map((p, idx) => {
                const stepNum = idx + 1;
                const isSelected = detailModalStepNum === stepNum;
                const isCurrentPipeStep = detailModalPipe.etapa_atual === stepNum;

                return (
                  <button
                    key={p.id || p.key}
                    type="button"
                    onClick={() => handleSwitchDetailStep(stepNum)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border",
                      isSelected
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    )}
                  >
                    <span>{stepNum}. {p.nome}</span>
                    {isCurrentPipeStep && (
                      <span className={cn("w-2 h-2 rounded-full shrink-0", isSelected ? "bg-amber-300" : "bg-amber-500")} title="Etapa atual em andamento" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-4">
              {/* Caminho da Rede */}
              <div>
                <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5 mb-1">
                  <Folder className="w-4 h-4 text-indigo-600" />
                  Caminho da Rede (Pasta do Servidor da Etapa {detailModalStepNum})
                </label>
                <div className="flex items-center gap-2">
                  <input 
                    type="text"
                    value={detailModalPath}
                    onChange={(e) => setDetailModalPath(e.target.value)}
                    placeholder="Ex: \\servidor\fiscal\cliente\etapa_1"
                    className="flex-1 h-10 px-3 border border-slate-200 rounded-lg text-xs font-mono bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none"
                  />
                  {detailModalPath && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(detailModalPath);
                        alert('Caminho copiado para a área de transferência!');
                      }}
                      className="px-3 py-2 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 rounded-lg text-xs font-medium transition-colors border border-slate-200 shrink-0 cursor-pointer"
                    >
                      Copiar
                    </button>
                  )}
                </div>
              </div>

              {/* Texto Livre / Observações */}
              <div>
                <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5 mb-1">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  Informações Livres / Observações da Etapa {detailModalStepNum} ({phases[detailModalStepNum - 1]?.nome})
                </label>
                <textarea
                  rows={4}
                  value={detailModalNotes}
                  onChange={(e) => setDetailModalNotes(e.target.value)}
                  placeholder="Digite aqui qualquer informação, instruções, notas de acompanhamento ou links referentes a esta etapa..."
                  className="w-full p-3 border border-slate-200 rounded-lg text-xs text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setDetailModalPipe(null);
                  setDetailModalStepNum(null);
                }}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={savingDetail}
                onClick={handleSaveDetail}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-700 text-white rounded-lg text-xs font-semibold hover:bg-indigo-800 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {savingDetail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar Detalhes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
