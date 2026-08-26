import { useState, useEffect, useMemo } from 'react';
import { 
  Loader2, 
  Compass, 
  FileCheck, 
  ShieldCheck, 
  Search, 
  Calendar, 
  Building2, 
  RefreshCw,
  GitMerge
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
  FaseGrupoEnum,
  REGIMES_CONFIG,
  SEGMENTOS_POR_REGIME,
  getRegimeFromSegmento,
  RegimeEnum
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
  const [selectedRegime, setSelectedRegime] = useState<string>('todos');
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

  // States do Modal de Detalhes (Datas e Múltiplos Responsáveis)
  const [detailModalStartDate, setDetailModalStartDate] = useState<string>('');
  const [detailModalEndDate, setDetailModalEndDate] = useState<string>('');
  const [detailModalStartAsIs, setDetailModalStartAsIs] = useState<string>('');
  const [detailModalStartToBe, setDetailModalStartToBe] = useState<string>('');
  const [detailModalSelectedMemberIds, setDetailModalSelectedMemberIds] = useState<string[]>([]);

  // Clientes filtrados por Busca, Regime, Segmento e Tipo de Contrato (Apenas Recorrentes)
  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      // Empresas em POC ativa ficam restritas ao Módulo POC; só entram no Fluxo de Trabalho ao converter
      if (c.tipo_contrato === 'poc') return false;

      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        c.razao_social.toLowerCase().includes(searchLower) ||
        c.cnpj.includes(searchTerm) ||
        (c.nome_grupo && c.nome_grupo.toLowerCase().includes(searchLower)) ||
        c.segmento.toLowerCase().includes(searchLower);

      const clientRegime = c.regime || getRegimeFromSegmento(c.segmento);
      const matchesRegime = selectedRegime === 'todos' || clientRegime === selectedRegime;
      const matchesSegment = selectedSegment === 'todos' || c.segmento === selectedSegment;

      return matchesSearch && matchesRegime && matchesSegment;
    });
  }, [clients, searchTerm, selectedRegime, selectedSegment]);

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

  const getClientPhasesForGroup = (client: Client, grupo: FaseGrupoEnum) => {
    const cRegime = client.regime || getRegimeFromSegmento(client.segmento);
    const targetPhases = grupo === 'fase_1' ? fasesDiagnostico : grupo === 'fase_2' ? fasesPlanoAcao : fasesGovernanca;
    return targetPhases.filter(p => !p.regime || p.regime === 'geral' || p.regime === cRegime);
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

    const clientPhases = getClientPhasesForGroup(client, grupo);
    const phaseKey = clientPhases[stepNum - 1]?.key || '';

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

    // Carregar datas e múltiplos responsáveis
    const stepDates = pipe?.datas_etapas?.[stepKey];
    setDetailModalStartDate(stepDates?.data_inicio || '');
    setDetailModalEndDate(stepDates?.data_fim || '');
    setDetailModalStartAsIs(pipe?.start_as_is || '');
    setDetailModalStartToBe(pipe?.start_to_be || '');
    setDetailModalSelectedMemberIds(pipe?.responsaveis_multiplos_etapas?.[stepKey] || []);

    setDetailModalOpen(true);
  };

  const handleSwitchDetailStep = (stepNum: number) => {
    if (!detailModalClient) return;
    setDetailModalStepNum(stepNum);

    const stepKey = String(stepNum);
    const path = detailModalPipe?.caminhos_rede_etapas?.[stepKey] || (stepNum === 1 ? (detailModalPipe?.caminho_rede || '') : '');
    const notes = detailModalPipe?.observacoes_etapas?.[stepKey] || '';

    const clientPhases = getClientPhasesForGroup(detailModalClient, detailModalGroup);
    const phaseKey = clientPhases[stepNum - 1]?.key || '';

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

    const stepDates = detailModalPipe?.datas_etapas?.[stepKey];
    setDetailModalStartDate(stepDates?.data_inicio || '');
    setDetailModalEndDate(stepDates?.data_fim || '');
    setDetailModalSelectedMemberIds(detailModalPipe?.responsaveis_multiplos_etapas?.[stepKey] || []);
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
            },
            datas_etapas: {
              [stepKey]: {
                data_inicio: detailModalStartDate || null,
                data_fim: detailModalEndDate || null
              }
            },
            start_as_is: detailModalStartAsIs || null,
            start_to_be: detailModalStartToBe || null,
            responsaveis_multiplos_etapas: {
              [stepKey]: detailModalSelectedMemberIds
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

        const currentDatas = targetPipe.datas_etapas || {};
        const updatedDatas = {
          ...currentDatas,
          [stepKey]: {
            data_inicio: detailModalStartDate || null,
            data_fim: detailModalEndDate || null
          }
        };

        const currentMultiples = targetPipe.responsaveis_multiplos_etapas || {};
        const updatedMultiples = {
          ...currentMultiples,
          [stepKey]: detailModalSelectedMemberIds
        };

        const { error: upErr } = await supabase
          .from('workflow_pipelines')
          .update({
            caminhos_rede_etapas: updatedPaths,
            observacoes_etapas: updatedNotes,
            responsaveis_etapas: updatedResps,
            datas_etapas: updatedDatas,
            start_as_is: detailModalStartAsIs || null,
            start_to_be: detailModalStartToBe || null,
            responsaveis_multiplos_etapas: updatedMultiples,
            caminho_rede: detailModalStepNum === 1 ? detailModalPath : (targetPipe.caminho_rede || detailModalPath),
            updated_at: new Date().toISOString()
          })
          .eq('id', targetPipe.id);

        if (upErr) throw upErr;
      }

      await logActivity({
        titulo: 'Detalhes da Etapa Atualizados',
        descricao: `Datas do cronograma e responsáveis atualizados para ${detailModalClient.razao_social}`,
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

  // Alternar Status Tricolor da Etapa (Verde / Amarelo / Vermelho)
  const handleUpdateStepStatus = async (client: Client, stepNum: number, newStatus: 'verde' | 'amarelo' | 'vermelho' | 'pendente') => {
    try {
      let pipe = pipelines.find(p => p.client_id === client.id && p.fase_grupo === 'fase_1');
      const stepKey = String(stepNum);

      if (!pipe) {
        const { data: newPipe, error: insErr } = await supabase
          .from('workflow_pipelines')
          .insert({
            client_id: client.id,
            fase_grupo: 'fase_1',
            status: 'em_andamento',
            etapa_atual: stepNum,
            status_etapas: { [stepKey]: newStatus }
          })
          .select()
          .single();

        if (insErr) throw insErr;
      } else {
        const currentStatusMap = pipe.status_etapas || {};
        const updatedMap = { ...currentStatusMap, [stepKey]: newStatus };

        const { error: upErr } = await supabase
          .from('workflow_pipelines')
          .update({
            status_etapas: updatedMap,
            updated_at: new Date().toISOString()
          })
          .eq('id', pipe.id);

        if (upErr) throw upErr;
      }

      fetchData();
    } catch (err: unknown) {
      console.error('Erro ao atualizar status da etapa:', err);
    }
  };

  // Salvar Período do Escopo (Item 3)
  const handleSavePeriodoEscopo = async (client: Client, periodo: string) => {
    try {
      let pipe = pipelines.find(p => p.client_id === client.id && p.fase_grupo === 'fase_1');
      if (!pipe) {
        const { error: insErr } = await supabase
          .from('workflow_pipelines')
          .insert({
            client_id: client.id,
            fase_grupo: 'fase_1',
            status: 'iniciado',
            etapa_atual: 1,
            periodo_escopo: periodo
          });
        if (insErr) throw insErr;
      } else {
        const { error: upErr } = await supabase
          .from('workflow_pipelines')
          .update({ periodo_escopo: periodo, updated_at: new Date().toISOString() })
          .eq('id', pipe.id);
        if (upErr) throw upErr;
      }
      fetchData();
    } catch (err: unknown) {
      console.error('Erro ao salvar período do escopo:', err);
    }
  };

  // Marcar Fase como Não Aplicável (Item 9)
  const handleTogglePhaseDisabled = async (client: Client, grupo: 'fase_2' | 'fase_3', disabled: boolean) => {
    try {
      let pipe = pipelines.find(p => p.client_id === client.id && p.fase_grupo === 'fase_1');
      if (!pipe) return;

      const currentDisabled = pipe.fases_desabilitadas || {};
      const updatedDisabled = { ...currentDisabled, [grupo]: disabled };

      const { error: upErr } = await supabase
        .from('workflow_pipelines')
        .update({ fases_desabilitadas: updatedDisabled, updated_at: new Date().toISOString() })
        .eq('id', pipe.id);

      if (upErr) throw upErr;

      fetchData();
    } catch (err: unknown) {
      console.error('Erro ao alternar fase desabilitada:', err);
    }
  };

  // Estatísticas do Topo Normalizadas (Apenas Clientes Recorrentes)
  const topStats = useMemo(() => {
    const recurrentClients = clients.filter(c => c.tipo_contrato !== 'poc');
    const totalClients = recurrentClients.length;
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
    <div className="flex flex-col w-full gap-6 relative p-2 animate-in fade-in duration-300">
      {/* Cabeçalho Hero do Módulo Cliente Recorrente */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner shrink-0">
            <GitMerge className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 uppercase tracking-wider">
                3 Fases Integradas
              </span>
            </div>
            <h1 className="text-2xl font-black text-white mt-1 tracking-tight">
              Cliente Recorrente
            </h1>
            <p className="text-xs text-indigo-100/80 mt-1 max-w-xl">
              Acompanhe a jornada completa de cada empresa através de <strong>Diagnóstico</strong>, <strong>Plano de Ação</strong> e <strong>Governança</strong>.
            </p>
          </div>
        </div>

        {/* Métricas Rápidas & Controles no Header */}
        <div className="flex flex-col gap-3 relative z-10 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/10">
            {/* Metric 1: Empresas Monitoradas */}
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider">Empresas</span>
              <span className="text-xl font-black text-white mt-0.5">{topStats.totalClients}</span>
              <span className="text-[10px] text-slate-400">Ativas cadastradas</span>
            </div>

            {/* Metric 2: Fase 1 */}
            <div className="flex flex-col border-l border-white/10 pl-3">
              <span className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider">Diagnóstico</span>
              <span className="text-xl font-black text-indigo-200 mt-0.5">{topStats.f1Concluidos} / {topStats.totalClients}</span>
              <span className="text-[10px] text-indigo-300/80">{topStats.f1EmAndamento} em andamento</span>
            </div>

            {/* Metric 3: Fase 2 */}
            <div className="flex flex-col border-l border-white/10 pl-3">
              <span className="text-[10px] uppercase font-bold text-blue-300 tracking-wider">Plano Ação</span>
              <span className="text-xl font-black text-blue-200 mt-0.5">{topStats.f2NoAno}</span>
              <span className="text-[10px] text-blue-300/80">{topStats.f2EmAndamento} em andamento ({selectedYear})</span>
            </div>

            {/* Metric 4: Fase 3 */}
            <div className="flex flex-col border-l border-white/10 pl-3">
              <span className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider">Governança</span>
              <span className="text-xl font-black text-emerald-400 mt-0.5">{topStats.f3NoAno}</span>
              <span className="text-[10px] text-emerald-300/80">{topStats.f3EmAndamento} em andamento ({selectedYear})</span>
            </div>
          </div>

          {/* Controls Bar inside Header */}
          <div className="flex items-center justify-end gap-2">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/10 rounded-xl px-3 py-1.5 text-white">
              <Calendar className="w-3.5 h-3.5 text-indigo-300" />
              <span className="text-[11px] font-semibold text-slate-300">Ano:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="text-xs font-bold text-white bg-transparent outline-none cursor-pointer [&>option]:text-slate-900"
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <button
              onClick={fetchData}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-xl text-xs font-semibold backdrop-blur-md transition-colors cursor-pointer"
              title="Recarregar dados"
            >
              <RefreshCw className="w-3.5 h-3.5 text-indigo-300" />
              Atualizar
            </button>
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
            placeholder="Buscar por Razão Social, CNPJ ou Segmento..."
            className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-slate-500">Regime:</span>
            <select
              value={selectedRegime}
              onChange={(e) => setSelectedRegime(e.target.value)}
              className="h-9 px-3 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer"
            >
              <option value="todos">Todos os Regimes</option>
              <option value="regular">Regime Regular (Normal)</option>
              <option value="especifico">Regimes Específicos</option>
              <option value="diferenciado">Regimes Diferenciados</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-slate-500">Segmento:</span>
            <select
              value={selectedSegment}
              onChange={(e) => setSelectedSegment(e.target.value)}
              className="h-9 px-3 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer max-w-[220px]"
            >
              <option value="todos">Todos os Segmentos</option>
              {SEGMENTOS_POR_REGIME.map(grupo => (
                <optgroup key={grupo.regime} label={grupo.label}>
                  {grupo.segmentos.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
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
          {filteredClients.map((client) => {
            const clientRegime = client.regime || getRegimeFromSegmento(client.segmento);
            const clientFasesDiag = fasesDiagnostico.filter(p => !p.regime || p.regime === 'geral' || p.regime === clientRegime);
            const clientFasesPlano = fasesPlanoAcao.filter(p => !p.regime || p.regime === 'geral' || p.regime === clientRegime);
            const clientFasesGov = fasesGovernanca.filter(p => !p.regime || p.regime === 'geral' || p.regime === clientRegime);

            return (
              <CompanyWorkflowCard
                key={client.id}
                client={client}
                selectedYear={selectedYear}
                pipelines={pipelines}
                fasesDiagnostico={clientFasesDiag}
                fasesPlanoAcao={clientFasesPlano}
                fasesGovernanca={clientFasesGov}
                members={members}
                assignments={assignments}
                onAdvanceFase1={handleAdvanceFase1}
                onRegressFase1={handleRegressFase1}
                onAdvanceMonthly={handleAdvanceMonthlyFlow}
                onOpenDetail={openDetailModal}
                onOpenAnalytic={(c) => setAnalyticClient(c)}
                onTogglePhaseDisabled={handleTogglePhaseDisabled}
                onUpdateStepStatus={handleUpdateStepStatus}
                onSavePeriodoEscopo={handleSavePeriodoEscopo}
              />
            );
          })}
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
          fasesDiagnostico={getClientPhasesForGroup(detailModalClient, 'fase_1')}
          fasesPlanoAcao={getClientPhasesForGroup(detailModalClient, 'fase_2')}
          fasesGovernanca={getClientPhasesForGroup(detailModalClient, 'fase_3')}
          members={members}
          path={detailModalPath}
          notes={detailModalNotes}
          principalId={detailModalPrincipalId}
          backupId={detailModalBackupId}
          startDate={detailModalStartDate}
          endDate={detailModalEndDate}
          startAsIs={detailModalStartAsIs}
          startToBe={detailModalStartToBe}
          selectedMemberIds={detailModalSelectedMemberIds}
          saving={savingDetail}
          onClose={() => setDetailModalOpen(false)}
          onSwitchStep={handleSwitchDetailStep}
          onPathChange={setDetailModalPath}
          onNotesChange={setDetailModalNotes}
          onPrincipalChange={setDetailModalPrincipalId}
          onBackupChange={setDetailModalBackupId}
          onStartDateChange={setDetailModalStartDate}
          onEndDateChange={setDetailModalEndDate}
          onStartAsIsChange={setDetailModalStartAsIs}
          onStartToBeChange={setDetailModalStartToBe}
          onSelectedMemberIdsChange={setDetailModalSelectedMemberIds}
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
