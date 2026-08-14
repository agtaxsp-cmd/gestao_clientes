import { useState, useEffect, useMemo } from 'react';
import { 
  Loader2, 
  Compass, 
  FileCheck, 
  ShieldCheck, 
  Search, 
  Calendar, 
  Building2, 
  RefreshCw 
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/logger';
import { useAuth } from '../contexts/AuthContext';
import { 
  WorkflowPipeline, 
  Client, 
  PipelineStatusEnum, 
  WorkflowAssignment, 
  WorkflowPhase, 
  TeamMember, 
  FaseGrupoEnum 
} from '../types';
import { useLocation, useNavigate } from 'react-router-dom';
import CompanyWorkflowCard from '../components/workflow/CompanyWorkflowCard';
import WorkflowDetailModal from '../components/workflow/WorkflowDetailModal';
import WorkflowAnalyticModal from '../components/workflow/WorkflowAnalyticModal';

export default function FluxoTrabalho() {
  const { getUserName } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Dados principais
  const [clients, setClients] = useState<Client[]>([]);
  const [phases, setPhases] = useState<WorkflowPhase[]>([]);
  const [assignments, setAssignments] = useState<WorkflowAssignment[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [pipelines, setPipelines] = useState<WorkflowPipeline[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSegment, setSelectedSegment] = useState<string>('todos');

  // Modal Detalhes da Etapa / Mês
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailModalPipe, setDetailModalPipe] = useState<WorkflowPipeline | null>(null);
  const [detailModalClient, setDetailModalClient] = useState<Client | null>(null);
  const [detailModalGroup, setDetailModalGroup] = useState<FaseGrupoEnum>('fase_1');
  const [detailModalStepNum, setDetailModalStepNum] = useState<number>(1);
  const [detailModalMonth, setDetailModalMonth] = useState<number | null>(null);
  const [detailModalPath, setDetailModalPath] = useState<string>('');
  const [detailModalNotes, setDetailModalNotes] = useState<string>('');
  const [detailModalPrincipalId, setDetailModalPrincipalId] = useState<string>('');
  const [detailModalBackupId, setDetailModalBackupId] = useState<string>('');
  const [savingDetail, setSavingDetail] = useState(false);

  // Modal Visão Analítica Completa (Deep Dive)
  const [analyticClient, setAnalyticClient] = useState<Client | null>(null);

  // ────────────────────────────────────────────────
  // Fetch de dados
  // ────────────────────────────────────────────────
  const fetchData = async () => {
    try {
      setLoading(true);

      // 1. Fases
      const { data: phasesData, error: phaseErr } = await supabase
        .from('workflow_phases')
        .select('*')
        .order('ordem', { ascending: true });
      if (phaseErr) console.error('Erro ao buscar fases:', phaseErr);
      setPhases(phasesData || []);

      // 2. Clientes
      const { data: clientsData, error: clientErr } = await supabase
        .from('clients')
        .select('*')
        .order('razao_social');
      if (clientErr) throw clientErr;
      setClients(clientsData || []);

      // 3. Membros
      const { data: membersData, error: memErr } = await supabase
        .from('team_members')
        .select('*')
        .order('nome');
      if (memErr) console.error('Erro ao carregar membros:', memErr);
      setMembers(membersData || []);

      // 4. Atribuições globais
      const { data: assignData, error: assErr } = await supabase
        .from('workflow_assignments')
        .select('*, responsavel_principal:team_members!responsavel_principal_id(*), responsavel_backup:team_members!responsavel_backup_id(*)');
      if (assErr) console.error('Erro ao carregar responsáveis:', assErr);
      setAssignments(assignData || []);

      // 5. Pipelines existentes
      const { data: pipeData, error: pipeErr } = await supabase
        .from('workflow_pipelines')
        .select('*');
      if (pipeErr) throw pipeErr;
      setPipelines(pipeData || []);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Erro ao carregar fluxos de trabalho:', message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Efeito para abrir modal da etapa vindo das Notificações / Atribuídas a Mim
  useEffect(() => {
    if (loading || clients.length === 0) return;

    const locState = location.state as {
      clientId?: string;
      grupo?: FaseGrupoEnum;
      stepNum?: number;
      month?: number | null;
    } | null;

    if (locState?.clientId && locState?.grupo) {
      const targetClient = clients.find(c => c.id === locState.clientId);
      if (targetClient) {
        openDetailModal(
          targetClient,
          locState.grupo,
          locState.stepNum || 1,
          locState.month
        );
        // Limpa o state para não reabrir em navegações futuras
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [loading, clients, location.state]);

  // Fases agrupadas
  const fasesDiagnostico = useMemo(() => {
    return phases.filter(p => p.grupo_fase === 'fase_1').sort((a, b) => a.ordem - b.ordem);
  }, [phases]);

  const fasesPlanoAcao = useMemo(() => {
    return phases.filter(p => p.grupo_fase === 'fase_2').sort((a, b) => a.ordem - b.ordem);
  }, [phases]);

  const fasesGovernanca = useMemo(() => {
    return phases.filter(p => p.grupo_fase === 'fase_3').sort((a, b) => a.ordem - b.ordem);
  }, [phases]);

  // Clientes filtrados
  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      const matchesSearch = 
        c.razao_social.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.cnpj.includes(searchTerm);
      const matchesSegment = 
        selectedSegment === 'todos' || c.segmento === selectedSegment;
      return matchesSearch && matchesSegment;
    });
  }, [clients, searchTerm, selectedSegment]);

  // ────────────────────────────────────────────────
  // Operações de Avanço e Retorno
  // ────────────────────────────────────────────────

  // Avançar Etapa na Fase 1 (Diagnóstico)
  const handleAdvanceFase1 = async (client: Client, currentPipe?: WorkflowPipeline) => {
    try {
      const totalSteps = fasesDiagnostico.length || 7;
      let pipe = currentPipe;

      if (!pipe) {
        const { data: newPipe, error: insErr } = await supabase
          .from('workflow_pipelines')
          .insert({
            client_id: client.id,
            fase_grupo: 'fase_1',
            status: 'em_andamento',
            etapa_atual: 2,
            mensagem_info: `Em andamento na etapa 2: ${fasesDiagnostico[1]?.nome || ''}`,
            mes_referencia: null
          })
          .select()
          .single();

        if (insErr) throw insErr;
        pipe = newPipe;
      } else {
        const nextStep = pipe.etapa_atual + 1;
        const isFinished = nextStep > totalSteps;
        const nextStatus: PipelineStatusEnum = isFinished ? 'concluido' : 'em_andamento';
        const nextMsg = isFinished 
          ? 'Diagnóstico finalizado com sucesso!' 
          : `Em andamento na etapa ${nextStep}: ${fasesDiagnostico[nextStep - 1]?.nome || ''}`;

        const { error: upErr } = await supabase
          .from('workflow_pipelines')
          .update({
            etapa_atual: isFinished ? totalSteps : nextStep,
            status: nextStatus,
            mensagem_info: nextMsg,
            updated_at: new Date().toISOString()
          })
          .eq('id', pipe.id);

        if (upErr) throw upErr;
      }

      await logActivity({
        titulo: 'Avanço no Diagnóstico',
        descricao: `Etapa avançada no fluxo de Diagnóstico de ${client.razao_social}`,
        tipo_log: 'info',
        client_id: client.id,
        usuario_nome: getUserName()
      });

      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert('Erro ao avançar etapa: ' + message);
    }
  };

  // Retornar Etapa na Fase 1
  const handleRegressFase1 = async (client: Client, pipe: WorkflowPipeline) => {
    if (pipe.etapa_atual <= 1 && pipe.status !== 'concluido') return;
    try {
      const prevStep = pipe.status === 'concluido' ? pipe.etapa_atual : Math.max(1, pipe.etapa_atual - 1);
      const prevStatus: PipelineStatusEnum = prevStep === 1 ? 'iniciado' : 'em_andamento';
      const prevMsg = `Retornado para a etapa ${prevStep}: ${fasesDiagnostico[prevStep - 1]?.nome || ''}`;

      const { error: upErr } = await supabase
        .from('workflow_pipelines')
        .update({
          etapa_atual: prevStep,
          status: prevStatus,
          mensagem_info: prevMsg,
          updated_at: new Date().toISOString()
        })
        .eq('id', pipe.id);

      if (upErr) throw upErr;

      await logActivity({
        titulo: 'Retorno no Diagnóstico',
        descricao: `Etapa retornada para ${prevStep} no Diagnóstico de ${client.razao_social}`,
        tipo_log: 'sync',
        client_id: client.id,
        usuario_nome: getUserName()
      });

      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert('Erro ao retornar etapa: ' + message);
    }
  };

  // Avançar / Atualizar Status em Fluxos Mensais (Fase 2 ou Fase 3)
  const handleAdvanceMonthlyFlow = async (
    client: Client, 
    grupo: 'fase_2' | 'fase_3', 
    month: number, 
    year: number
  ) => {
    try {
      const pipe = pipelines.find(
        p => p.client_id === client.id &&
             p.fase_grupo === grupo &&
             p.ano_referencia === year &&
             p.mes_referencia === month
      );
      const maxSteps = grupo === 'fase_2' ? (fasesPlanoAcao.length || 2) : (fasesGovernanca.length || 1);

      if (!pipe) {
        const stepName = grupo === 'fase_2' ? (fasesPlanoAcao[0]?.nome || 'ELABORAR') : (fasesGovernanca[0]?.nome || 'AUDITORIA');
        const { error: insErr } = await supabase
          .from('workflow_pipelines')
          .insert({
            client_id: client.id,
            fase_grupo: grupo,
            ano_referencia: year,
            mes_referencia: month,
            etapa_atual: 1,
            status: maxSteps === 1 ? 'concluido' : 'em_andamento',
            mensagem_info: maxSteps === 1 ? `${stepName} concluída` : `Em andamento: ${stepName}`
          });

        if (insErr) throw insErr;
      } else {
        let nextStep = pipe.etapa_atual + 1;
        let nextStatus: PipelineStatusEnum = 'em_andamento';
        let nextMsg = '';

        if (pipe.status === 'concluido') {
          nextStep = 1;
          nextStatus = 'em_andamento';
          nextMsg = `Reiniciado para etapa 1 (${grupo === 'fase_2' ? 'ELABORAR' : 'AUDITORIA'})`;
        } else if (nextStep > maxSteps) {
          nextStep = maxSteps;
          nextStatus = 'concluido';
          nextMsg = `Mês ${month}/${year} concluído com sucesso`;
        } else {
          const stepObj = grupo === 'fase_2' ? fasesPlanoAcao[nextStep - 1] : fasesGovernanca[nextStep - 1];
          nextMsg = `Em andamento na etapa ${nextStep}: ${stepObj?.nome || ''}`;
        }

        const { error: upErr } = await supabase
          .from('workflow_pipelines')
          .update({
            etapa_atual: nextStep,
            status: nextStatus,
            mensagem_info: nextMsg,
            updated_at: new Date().toISOString()
          })
          .eq('id', pipe.id);

        if (upErr) throw upErr;
      }

      await logActivity({
        titulo: `Atualização ${grupo === 'fase_2' ? 'Plano de Ação' : 'Governança'}`,
        descricao: `Status do mês ${month}/${year} atualizado para ${client.razao_social}`,
        tipo_log: 'info',
        client_id: client.id,
        usuario_nome: getUserName()
      });

      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert('Erro ao atualizar fluxo mensal: ' + message);
    }
  };

  // ────────────────────────────────────────────────
  // Modal de Detalhes da Etapa / Mês
  // ────────────────────────────────────────────────
  const openDetailModal = (
    client: Client, 
    grupo: FaseGrupoEnum, 
    stepNum: number, 
    month?: number | null
  ) => {
    let pipe: WorkflowPipeline | undefined;
    if (grupo === 'fase_1') {
      pipe = pipelines.find(p => p.client_id === client.id && p.fase_grupo === 'fase_1');
    } else {
      pipe = pipelines.find(
        p => p.client_id === client.id &&
             p.fase_grupo === grupo &&
             p.ano_referencia === selectedYear &&
             p.mes_referencia === (month || 1)
      );
    }

    setDetailModalClient(client);
    setDetailModalGroup(grupo);
    setDetailModalStepNum(stepNum);
    setDetailModalMonth(month ?? null);
    setDetailModalPipe(pipe || null);

    const stepKey = String(stepNum);
    const path = pipe?.caminhos_rede_etapas?.[stepKey] || (stepNum === 1 ? (pipe?.caminho_rede || '') : '');
    const notes = pipe?.observacoes_etapas?.[stepKey] || '';

    let phaseKey = '';
    if (grupo === 'fase_1') {
      phaseKey = fasesDiagnostico[stepNum - 1]?.key || '';
    } else if (grupo === 'fase_2') {
      phaseKey = fasesPlanoAcao[stepNum - 1]?.key || '';
    } else {
      phaseKey = fasesGovernanca[stepNum - 1]?.key || '';
    }

    const defaultAssign = assignments.find(a => a.fase_fluxo === phaseKey);
    const custom = pipe?.responsaveis_etapas?.[stepKey];

    const principalId = (custom && custom.principal_id !== undefined)
      ? (custom.principal_id || '')
      : (defaultAssign?.responsavel_principal_id || '');

    const backupId = (custom && custom.backup_id !== undefined)
      ? (custom.backup_id || '')
      : (defaultAssign?.responsavel_backup_id || '');

    setDetailModalPath(path);
    setDetailModalNotes(notes);
    setDetailModalPrincipalId(principalId);
    setDetailModalBackupId(backupId);
    setDetailModalOpen(true);
  };

  const handleSwitchDetailStep = (stepNum: number) => {
    if (!detailModalClient) return;
    setDetailModalStepNum(stepNum);

    const stepKey = String(stepNum);
    const path = detailModalPipe?.caminhos_rede_etapas?.[stepKey] || (stepNum === 1 ? (detailModalPipe?.caminho_rede || '') : '');
    const notes = detailModalPipe?.observacoes_etapas?.[stepKey] || '';

    let phaseKey = '';
    if (detailModalGroup === 'fase_1') {
      phaseKey = fasesDiagnostico[stepNum - 1]?.key || '';
    } else if (detailModalGroup === 'fase_2') {
      phaseKey = fasesPlanoAcao[stepNum - 1]?.key || '';
    } else {
      phaseKey = fasesGovernanca[stepNum - 1]?.key || '';
    }

    const defaultAssign = assignments.find(a => a.fase_fluxo === phaseKey);
    const custom = detailModalPipe?.responsaveis_etapas?.[stepKey];

    const principalId = (custom && custom.principal_id !== undefined)
      ? (custom.principal_id || '')
      : (defaultAssign?.responsavel_principal_id || '');

    const backupId = (custom && custom.backup_id !== undefined)
      ? (custom.backup_id || '')
      : (defaultAssign?.responsavel_backup_id || '');

    setDetailModalPath(path);
    setDetailModalNotes(notes);
    setDetailModalPrincipalId(principalId);
    setDetailModalBackupId(backupId);
  };

  const handleSaveDetail = async () => {
    if (!detailModalClient) return;
    try {
      setSavingDetail(true);
      const stepKey = String(detailModalStepNum);

      let targetPipe = detailModalPipe;

      if (!targetPipe) {
        const { data: newPipe, error: insErr } = await supabase
          .from('workflow_pipelines')
          .insert({
            client_id: detailModalClient.id,
            fase_grupo: detailModalGroup,
            ano_referencia: detailModalGroup === 'fase_1' ? null : selectedYear,
            mes_referencia: detailModalGroup === 'fase_1' ? null : (detailModalMonth || 1),
            etapa_atual: detailModalStepNum,
            status: 'em_andamento',
            caminhos_rede_etapas: { [stepKey]: detailModalPath },
            observacoes_etapas: { [stepKey]: detailModalNotes },
            responsaveis_etapas: {
              [stepKey]: {
                principal_id: detailModalPrincipalId || null,
                backup_id: detailModalBackupId || null
              }
            }
          })
          .select()
          .single();

        if (insErr) throw insErr;
        targetPipe = newPipe;
      } else {
        const currentPaths = targetPipe.caminhos_rede_etapas || {};
        const updatedPaths = { ...currentPaths, [stepKey]: detailModalPath };

        const currentNotes = targetPipe.observacoes_etapas || {};
        const updatedNotes = { ...currentNotes, [stepKey]: detailModalNotes };

        const currentResps = targetPipe.responsaveis_etapas || {};
        const updatedResps = {
          ...currentResps,
          [stepKey]: {
            principal_id: detailModalPrincipalId || null,
            backup_id: detailModalBackupId || null
          }
        };

        const { error: upErr } = await supabase
          .from('workflow_pipelines')
          .update({
            caminhos_rede_etapas: updatedPaths,
            observacoes_etapas: updatedNotes,
            responsaveis_etapas: updatedResps,
            caminho_rede: detailModalStepNum === 1 ? detailModalPath : (targetPipe.caminho_rede || detailModalPath),
            updated_at: new Date().toISOString()
          })
          .eq('id', targetPipe.id);

        if (upErr) throw upErr;
      }

      await logActivity({
        titulo: 'Detalhes da Etapa Atualizados',
        descricao: `Caminho de rede e notas atualizados para ${detailModalClient.razao_social}`,
        tipo_log: 'info',
        client_id: detailModalClient.id,
        usuario_nome: getUserName()
      });

      setDetailModalOpen(false);
      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert('Erro ao salvar detalhes: ' + message);
    } finally {
      setSavingDetail(false);
    }
  };

  // Estatísticas do Topo Normalizadas
  const topStats = useMemo(() => {
    const totalClients = clients.length;
    const f1Concluidos = pipelines.filter(p => p.fase_grupo === 'fase_1' && p.status === 'concluido').length;
    const f1EmAndamento = pipelines.filter(p => p.fase_grupo === 'fase_1' && p.status !== 'concluido').length;
    const f2NoAno = pipelines.filter(p => p.fase_grupo === 'fase_2' && p.ano_referencia === selectedYear && p.status === 'concluido').length;
    const f2EmAndamento = pipelines.filter(p => p.fase_grupo === 'fase_2' && p.ano_referencia === selectedYear && p.status === 'em_andamento').length;
    const f3NoAno = pipelines.filter(p => p.fase_grupo === 'fase_3' && p.ano_referencia === selectedYear && p.status === 'concluido').length;
    const f3EmAndamento = pipelines.filter(p => p.fase_grupo === 'fase_3' && p.ano_referencia === selectedYear && p.status === 'em_andamento').length;

    return { 
      totalClients, 
      f1Concluidos, 
      f1EmAndamento,
      f2NoAno, 
      f2EmAndamento,
      f3NoAno,
      f3EmAndamento 
    };
  }, [clients, pipelines, selectedYear]);

  // Lista dinâmica de anos idêntica ao módulo Checklist
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const baseYears = Array.from(
      { length: Math.max(1, currentYear - 2018 + 1) },
      (_, i) => 2018 + i
    );
    const pipeYears = pipelines
      .map(p => p.ano_referencia)
      .filter((y): y is number => typeof y === 'number' && Boolean(y));
    return Array.from(new Set([...baseYears, selectedYear, currentYear, ...pipeYears])).sort((a, b) => b - a);
  }, [pipelines, selectedYear]);

  return (
    <div className="flex flex-col w-full gap-8 relative p-2">
      {/* Header Superior */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end pb-4 border-b border-slate-200 gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-bold text-slate-900">Fluxo de Trabalho</h1>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              3 Fases Integradas
            </span>
          </div>
          <p className="text-slate-600 text-sm max-w-3xl">
            Acompanhe a jornada completa de cada empresa através de <strong>Diagnóstico</strong>, <strong>Plano de Ação</strong> e <strong>Governança</strong>.
          </p>
        </div>

        {/* Seletor de Ano & Atualizar */}
        <div className="flex items-center gap-3 self-end sm:self-auto">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-2xs">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-semibold text-slate-600">Ano:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="text-xs font-bold text-slate-900 bg-transparent outline-none cursor-pointer"
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            title="Recarregar dados"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            Atualizar
          </button>
        </div>
      </div>

      {/* KPI Ribbon Normalizado */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Empresas Monitoradas */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Empresas Monitoradas</span>
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
              <Building2 className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold text-slate-900">
              {topStats.totalClients}
            </div>
            <p className="text-xs text-slate-500 mt-1">Empresas ativas cadastradas</p>
          </div>
        </div>

        {/* Card 2: Fase 1 - Diagnóstico */}
        <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-2xs flex flex-col justify-between hover:shadow-md transition-all bg-gradient-to-br from-white to-indigo-50/25">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">Fase 1: Diagnóstico</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700">
              <Compass className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold text-indigo-950 flex items-baseline gap-1.5">
              <span>{topStats.f1Concluidos}</span>
              <span className="text-sm font-normal text-slate-500">/ {topStats.totalClients} concluídos</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">{topStats.f1EmAndamento} em andamento</p>
          </div>
        </div>

        {/* Card 3: Fase 2 - Plano de Ação */}
        <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-2xs flex flex-col justify-between hover:shadow-md transition-all bg-gradient-to-br from-white to-blue-50/25">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700">Fase 2: Plano de Ação</span>
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700">
              <FileCheck className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold text-blue-950 flex items-baseline gap-1.5">
              <span>{topStats.f2NoAno}</span>
              <span className="text-sm font-normal text-slate-500">meses concluídos</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">{topStats.f2EmAndamento} meses em andamento ({selectedYear})</p>
          </div>
        </div>

        {/* Card 4: Fase 3 - Governança */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-2xs flex flex-col justify-between hover:shadow-md transition-all bg-gradient-to-br from-white to-emerald-50/25">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Fase 3: Governança</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
              <ShieldCheck className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold text-emerald-950 flex items-baseline gap-1.5">
              <span>{topStats.f3NoAno}</span>
              <span className="text-sm font-normal text-slate-500">auditorias concluídas</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">{topStats.f3EmAndamento} em andamento ({selectedYear})</p>
          </div>
        </div>
      </div>

      {/* Barra de Filtros & Busca */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por Razão Social ou CNPJ..."
            className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs font-medium text-slate-500">Segmento:</span>
          <select
            value={selectedSegment}
            onChange={(e) => setSelectedSegment(e.target.value)}
            className="h-9 px-3 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer"
          >
            <option value="todos">Todos os Segmentos</option>
            <option value="industria">Indústria</option>
            <option value="comercio">Comércio</option>
            <option value="servico">Serviço</option>
          </select>
        </div>
      </div>

      {/* Conteúdo Principal: Cards das Empresas */}
      {loading ? (
        <div className="flex items-center justify-center p-16 text-slate-500 gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <span className="text-sm font-medium">Carregando fluxos de trabalho das empresas...</span>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-500 shadow-sm border border-slate-200">
          Nenhuma empresa encontrada com os filtros selecionados.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {filteredClients.map((client) => (
            <CompanyWorkflowCard
              key={client.id}
              client={client}
              selectedYear={selectedYear}
              pipelines={pipelines}
              fasesDiagnostico={fasesDiagnostico}
              fasesPlanoAcao={fasesPlanoAcao}
              fasesGovernanca={fasesGovernanca}
              members={members}
              assignments={assignments}
              onAdvanceFase1={handleAdvanceFase1}
              onRegressFase1={handleRegressFase1}
              onAdvanceMonthly={handleAdvanceMonthlyFlow}
              onOpenDetail={openDetailModal}
              onOpenAnalytic={(c) => setAnalyticClient(c)}
            />
          ))}
        </div>
      )}

      {/* Modal Detalhes da Etapa / Mês */}
      {detailModalOpen && detailModalClient && (
        <WorkflowDetailModal
          client={detailModalClient}
          grupo={detailModalGroup}
          stepNum={detailModalStepNum}
          month={detailModalMonth}
          pipe={detailModalPipe}
          fasesDiagnostico={fasesDiagnostico}
          fasesPlanoAcao={fasesPlanoAcao}
          fasesGovernanca={fasesGovernanca}
          members={members}
          path={detailModalPath}
          notes={detailModalNotes}
          principalId={detailModalPrincipalId}
          backupId={detailModalBackupId}
          saving={savingDetail}
          onClose={() => setDetailModalOpen(false)}
          onSwitchStep={handleSwitchDetailStep}
          onPathChange={setDetailModalPath}
          onNotesChange={setDetailModalNotes}
          onPrincipalChange={setDetailModalPrincipalId}
          onBackupChange={setDetailModalBackupId}
          onSave={handleSaveDetail}
        />
      )}

      {/* Modal Visão Analítica Completa */}
      {analyticClient && (
        <WorkflowAnalyticModal
          client={analyticClient}
          selectedYear={selectedYear}
          pipelines={pipelines}
          fasesDiagnostico={fasesDiagnostico}
          onClose={() => setAnalyticClient(null)}
        />
      )}
    </div>
  );
}
