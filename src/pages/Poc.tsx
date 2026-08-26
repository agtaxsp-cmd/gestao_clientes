import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Client, WorkflowPipeline, WorkflowPhase, TeamMember, getRegimeFromSegmento, REGIMES_CONFIG } from '../types';
import { 
  FlaskConical, 
  Search, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  Sparkles, 
  Check, 
  X, 
  Building2,
  Layers,
  Folder,
  FileText,
  Pencil,
  User,
  UserCheck,
  Save,
  Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { logActivity } from '../lib/logger';

export default function Poc() {
  const { getUserName } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [pocPhases, setPocPhases] = useState<WorkflowPhase[]>([]);
  const [pipelines, setPipelines] = useState<WorkflowPipeline[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'em_andamento' | 'convertido' | 'perdido'>('em_andamento');

  // Modal de Conversão para Recorrente
  const [convertingClient, setConvertingClient] = useState<Client | null>(null);
  const [fase1Contracted, setFase1Contracted] = useState(true);
  const [fase2Contracted, setFase2Contracted] = useState(true);
  const [fase3Contracted, setFase3Contracted] = useState(true);
  const [convertingLoading, setConvertingLoading] = useState(false);

  // Modal de Detalhes da Etapa da POC (Notas, arquivos, responsáveis)
  const [stepModalOpen, setStepModalOpen] = useState(false);
  const [stepModalClient, setStepModalClient] = useState<Client | null>(null);
  const [stepModalPhase, setStepModalPhase] = useState<{ id?: string; key?: string; nome: string; ordem: number } | null>(null);
  const [stepModalStepNum, setStepModalStepNum] = useState<number>(1);
  const [stepModalPipe, setStepModalPipe] = useState<WorkflowPipeline | null>(null);

  const [stepModalPath, setStepModalPath] = useState<string>('');
  const [stepModalNotes, setStepModalNotes] = useState<string>('');
  const [stepModalPrincipalId, setStepModalPrincipalId] = useState<string>('');
  const [stepModalBackupId, setStepModalBackupId] = useState<string>('');
  const [stepModalStatus, setStepModalStatus] = useState<'cinza' | 'amarelo' | 'verde' | 'vermelho'>('cinza');
  const [savingStepDetail, setSavingStepDetail] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);

      // 1. Clientes
      const { data: clientsData, error: clientErr } = await supabase
        .from('clients')
        .select('*')
        .order('razao_social');
      if (clientErr) throw clientErr;
      setClients(clientsData || []);

      // 2. Fases de POC (grupo_fase = 'fase_poc')
      const { data: phasesData, error: phaseErr } = await supabase
        .from('workflow_phases')
        .select('*')
        .eq('grupo_fase', 'fase_poc')
        .order('ordem', { ascending: true });
      if (phaseErr) console.error('Erro ao carregar fases de POC:', phaseErr);
      setPocPhases(phasesData || []);

      // 3. Pipelines existentes
      const { data: pipeData, error: pipeErr } = await supabase
        .from('workflow_pipelines')
        .select('*');
      if (pipeErr) throw pipeErr;
      setPipelines(pipeData || []);

      // 4. Membros
      const { data: memData, error: memErr } = await supabase
        .from('team_members')
        .select('*')
        .order('nome');
      if (memErr) console.error('Erro ao carregar membros:', memErr);
      setMembers(memData || []);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Erro ao carregar dados do Módulo POC:', message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Clientes com tipo_contrato = 'poc'
  const pocClients = clients.filter(c => c.tipo_contrato === 'poc');

  // Métricas
  const totalPocs = pocClients.length;
  const pocsEmAndamento = pocClients.filter(c => !c.status_poc || c.status_poc === 'em_andamento').length;
  const pocsConvertidas = pocClients.filter(c => c.status_poc === 'convertido').length;
  const taxaConversao = totalPocs > 0 ? Math.round((pocsConvertidas / totalPocs) * 100) : 0;

  // Filtragem na Lista
  const filteredClients = pocClients.filter(c => {
    const st = c.status_poc || 'em_andamento';
    if (statusFilter !== 'todos' && st !== statusFilter) return false;

    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const regime = c.regime || getRegimeFromSegmento(c.segmento);
    return (
      c.razao_social.toLowerCase().includes(term) ||
      c.cnpj.includes(term) ||
      (c.nome_grupo && c.nome_grupo.toLowerCase().includes(term)) ||
      c.segmento.toLowerCase().includes(term) ||
      regime.toLowerCase().includes(term)
    );
  });

  // Avançar etapa da POC
  const handleAdvancePocStep = async (client: Client) => {
    try {
      const pipe = pipelines.find(p => p.client_id === client.id && p.fase_grupo === 'fase_poc');
      const currentStep = pipe?.etapa_atual || 0;
      const totalSteps = pocPhases.length || 3;
      const nextStep = currentStep >= totalSteps ? totalSteps : currentStep + 1;
      const isCompleted = nextStep >= totalSteps;

      if (!pipe) {
        const { error: insErr } = await supabase
          .from('workflow_pipelines')
          .insert({
            client_id: client.id,
            fase_grupo: 'fase_poc',
            etapa_atual: 1,
            status: 'em_andamento'
          });
        if (insErr) throw insErr;
      } else {
        const { error: upErr } = await supabase
          .from('workflow_pipelines')
          .update({
            etapa_atual: nextStep,
            status: isCompleted ? 'concluido' : 'em_andamento',
            updated_at: new Date().toISOString()
          })
          .eq('id', pipe.id);
        if (upErr) throw upErr;
      }

      await logActivity({
        titulo: 'Etapa da POC Avançada',
        descricao: `Avançado para a etapa ${nextStep} da POC da empresa ${client.razao_social}`,
        tipo_log: 'info',
        client_id: client.id,
        usuario_nome: getUserName()
      });

      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert('Erro ao avançar etapa da POC: ' + message);
    }
  };

  // Abrir Modal de Detalhes da Etapa da POC
  const openPocStepModal = (
    client: Client, 
    phase: { id?: string; key?: string; nome: string; ordem: number }, 
    stepNum: number
  ) => {
    const pipe = pipelines.find(p => p.client_id === client.id && p.fase_grupo === 'fase_poc');
    const stepKey = String(stepNum);

    setStepModalClient(client);
    setStepModalPhase(phase);
    setStepModalStepNum(stepNum);
    setStepModalPipe(pipe || null);

    setStepModalPath(pipe?.caminhos_rede_etapas?.[stepKey] || '');
    setStepModalNotes(pipe?.observacoes_etapas?.[stepKey] || '');

    const customResp = pipe?.responsaveis_etapas?.[stepKey];
    setStepModalPrincipalId(customResp?.principal_id || '');
    setStepModalBackupId(customResp?.backup_id || '');

    const currentStepNum = pipe?.etapa_atual || 1;
    const isCompleted = client.status_poc === 'convertido' || currentStepNum > stepNum;
    const isCurrent = client.status_poc !== 'convertido' && currentStepNum === stepNum;

    const defaultStatus = isCompleted ? 'verde' : isCurrent ? 'amarelo' : 'cinza';
    const savedStatus = (pipe?.status_etapas?.[stepKey] as ('cinza' | 'amarelo' | 'verde' | 'vermelho')) || defaultStatus;

    setStepModalStatus(savedStatus);
    setStepModalOpen(true);
  };

  // Salvar Detalhes da Etapa da POC (Notas, arquivos, responsáveis)
  const handleSavePocStepDetail = async () => {
    if (!stepModalClient) return;

    try {
      setSavingStepDetail(true);
      const stepKey = String(stepModalStepNum);
      let targetPipe = stepModalPipe;

      if (!targetPipe) {
        const { data: newPipe, error: insErr } = await supabase
          .from('workflow_pipelines')
          .insert({
            client_id: stepModalClient.id,
            fase_grupo: 'fase_poc',
            etapa_atual: stepModalStepNum,
            status: 'em_andamento',
            caminhos_rede_etapas: { [stepKey]: stepModalPath },
            observacoes_etapas: { [stepKey]: stepModalNotes },
            responsaveis_etapas: {
              [stepKey]: {
                principal_id: stepModalPrincipalId || null,
                backup_id: stepModalBackupId || null
              }
            },
            status_etapas: { [stepKey]: stepModalStatus }
          })
          .select()
          .single();

        if (insErr) throw insErr;
        targetPipe = newPipe;
      } else {
        const updatedPaths = { ...(targetPipe.caminhos_rede_etapas || {}), [stepKey]: stepModalPath };
        const updatedNotes = { ...(targetPipe.observacoes_etapas || {}), [stepKey]: stepModalNotes };
        const updatedResps = {
          ...(targetPipe.responsaveis_etapas || {}),
          [stepKey]: {
            principal_id: stepModalPrincipalId || null,
            backup_id: stepModalBackupId || null
          }
        };
        const updatedStatuses = { ...(targetPipe.status_etapas || {}), [stepKey]: stepModalStatus };

        const { error: upErr } = await supabase
          .from('workflow_pipelines')
          .update({
            caminhos_rede_etapas: updatedPaths,
            observacoes_etapas: updatedNotes,
            responsaveis_etapas: updatedResps,
            status_etapas: updatedStatuses,
            updated_at: new Date().toISOString()
          })
          .eq('id', targetPipe.id);

        if (upErr) throw upErr;
      }

      await logActivity({
        titulo: 'Detalhes da POC Atualizados',
        descricao: `Notas, pasta de arquivos e responsáveis salvos para a etapa ${stepModalStepNum} (${stepModalPhase?.nome || ''}) da empresa ${stepModalClient.razao_social}`,
        tipo_log: 'info',
        client_id: stepModalClient.id,
        usuario_nome: getUserName()
      });

      setStepModalOpen(false);
      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert('Erro ao salvar detalhes da etapa da POC: ' + message);
    } finally {
      setSavingStepDetail(false);
    }
  };

  // Abrir Modal de Conversão para Cliente Recorrente
  const handleOpenConvertModal = (client: Client) => {
    setConvertingClient(client);
    setFase1Contracted(true);
    setFase2Contracted(true);
    setFase3Contracted(true);
  };

  // Executar Conversão de POC para Cliente Recorrente
  const handleExecuteConversion = async () => {
    if (!convertingClient) return;

    try {
      setConvertingLoading(true);

      // 1. Atualiza o cliente para tipo_contrato = 'recorrente' e status_poc = 'convertido'
      const { error: clientErr } = await supabase
        .from('clients')
        .update({
          tipo_contrato: 'recorrente',
          status_poc: 'convertido',
          updated_at: new Date().toISOString()
        })
        .eq('id', convertingClient.id);

      if (clientErr) throw clientErr;

      // 2. Salva as fases contratadas/desabilitadas no workflow_pipeline de Fase 1
      const fasesDesabilitadas = {
        fase_1: !fase1Contracted,
        fase_2: !fase2Contracted,
        fase_3: !fase3Contracted
      };

      const existingPipe1 = pipelines.find(p => p.client_id === convertingClient.id && p.fase_grupo === 'fase_1');
      if (existingPipe1) {
        await supabase
          .from('workflow_pipelines')
          .update({
            fases_desabilitadas: fasesDesabilitadas,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingPipe1.id);
      } else {
        await supabase
          .from('workflow_pipelines')
          .insert({
            client_id: convertingClient.id,
            fase_grupo: 'fase_1',
            status: 'iniciado',
            etapa_atual: 1,
            fases_desabilitadas: fasesDesabilitadas
          });
      }

      await logActivity({
        titulo: 'POC Convertida em Cliente Recorrente 🚀',
        descricao: `A empresa ${convertingClient.razao_social} foi convertida com sucesso para o fluxo contínuo de Recorrência!`,
        tipo_log: 'success',
        client_id: convertingClient.id,
        usuario_nome: getUserName()
      });

      setConvertingClient(null);
      fetchData();
      alert(`🎉 Empresa ${convertingClient.razao_social} convertida com sucesso para Cliente Recorrente!`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert('Erro ao converter cliente: ' + message);
    } finally {
      setConvertingLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      {/* Cabeçalho do Módulo POC */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-amber-900 via-amber-800 to-slate-900 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shadow-inner shrink-0">
            <FlaskConical className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30 uppercase tracking-wider">
                Esteira de Pré-Vendas
              </span>
            </div>
            <h1 className="text-2xl font-black text-white mt-1 tracking-tight">
              Módulo POC (Provas de Conceito)
            </h1>
            <p className="text-xs text-amber-100/80 mt-1 max-w-xl">
              Gerencie a validação técnica, amostragem e conversão comercial de empresas em teste para o fluxo contínuo de Recorrência.
            </p>
          </div>
        </div>

        {/* Métricas Rápidas no Header */}
        <div className="grid grid-cols-3 gap-3 relative z-10 bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/10 shrink-0">
          <div className="flex flex-col">
            <span className="text-[11px] text-amber-200/80 font-medium">POCs Ativas</span>
            <span className="text-xl font-black text-white mt-0.5">{pocsEmAndamento}</span>
          </div>
          <div className="flex flex-col border-l border-white/10 pl-3">
            <span className="text-[11px] text-emerald-300/80 font-medium">Convertidas</span>
            <span className="text-xl font-black text-emerald-400 mt-0.5">{pocsConvertidas}</span>
          </div>
          <div className="flex flex-col border-l border-white/10 pl-3">
            <span className="text-[11px] text-amber-200/80 font-medium">Taxa Conversão</span>
            <span className="text-xl font-black text-amber-300 mt-0.5">{taxaConversao}%</span>
          </div>
        </div>
      </div>

      {/* Controles e Filtros */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        {/* Barra de Busca */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por Razão Social, CNPJ, Grupo ou Segmento..."
            className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
          />
        </div>

        {/* Pílulas de Filtro de Status */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setStatusFilter('em_andamento')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
              statusFilter === 'em_andamento'
                ? "bg-amber-500 text-white shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            Em Andamento ({pocsEmAndamento})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('convertido')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
              statusFilter === 'convertido'
                ? "bg-emerald-600 text-white shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            Convertidas ({pocsConvertidas})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('todos')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
              statusFilter === 'todos'
                ? "bg-white text-slate-900 shadow-2xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            Todas ({totalPocs})
          </button>
        </div>
      </div>

      {/* Lista de Empresas em POC */}
      {loading ? (
        <div className="flex items-center justify-center p-16 text-slate-500 gap-3 bg-white rounded-2xl border border-slate-200">
          <Clock className="w-6 h-6 animate-spin text-amber-600" />
          <span className="text-sm font-medium">Carregando esteira de POCs...</span>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-500 shadow-xs border border-slate-200 flex flex-col items-center justify-center gap-3">
          <FlaskConical className="w-10 h-10 text-amber-400 opacity-60" />
          <p className="text-sm font-medium text-slate-700">Nenhuma empresa em POC encontrada com os filtros selecionados.</p>
          <p className="text-xs text-slate-400">Para cadastrar uma nova empresa em POC, vá para o módulo <strong>Clientes</strong> e selecione "Prova de Conceito (POC)".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredClients.map((client) => {
            const regime = client.regime || getRegimeFromSegmento(client.segmento);
            const regimeMeta = REGIMES_CONFIG[regime];
            const pipe = pipelines.find(p => p.client_id === client.id && p.fase_grupo === 'fase_poc');
            const currentStepNum = pipe?.etapa_atual || 1;
            const isPocConverted = client.status_poc === 'convertido';

            return (
              <div 
                key={client.id}
                className={cn(
                  "bg-white rounded-2xl p-5 border shadow-2xs hover:shadow-md transition-all flex flex-col gap-4 relative overflow-hidden",
                  isPocConverted ? "border-emerald-200 bg-emerald-50/10" : "border-slate-200"
                )}
              >
                {/* Cabeçalho do Card */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 font-bold flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-semibold text-slate-400">CNPJ: {client.cnpj}</span>
                        {client.nome_grupo && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            {client.nome_grupo}
                          </span>
                        )}
                        <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-bold border", regimeMeta.badgeBg, regimeMeta.badgeText, regimeMeta.badgeBorder)}>
                          {regimeMeta.shortLabel}
                        </span>
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 uppercase",
                          isPocConverted 
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300" 
                            : "bg-amber-100 text-amber-800 border-amber-300"
                        )}>
                          <FlaskConical className="w-3 h-3" />
                          {isPocConverted ? 'Convertido p/ Recorrente' : 'POC Em Andamento'}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-slate-900 mt-1">
                        {client.razao_social}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {client.segmento}
                      </p>
                    </div>
                  </div>

                  {/* Ações Rápidas */}
                  <div className="flex items-center gap-2 self-end md:self-auto">
                    {!isPocConverted && (
                      <button
                        type="button"
                        onClick={() => handleOpenConvertModal(client)}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs hover:from-emerald-700 hover:to-teal-700 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4 text-emerald-200" />
                        Converter para Recorrente
                      </button>
                    )}
                  </div>
                </div>

                {/* Stepper das Etapas da POC */}
                <div className="flex flex-col gap-2 bg-slate-50/80 p-4 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-amber-600" />
                      Progresso da POC
                    </span>
                    {!isPocConverted && (
                      <button
                        type="button"
                        onClick={() => handleAdvancePocStep(client)}
                        className="px-3 py-1 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer shadow-2xs flex items-center gap-1"
                      >
                        Avançar Etapa
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Passos da POC */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-1">
                    {(pocPhases.length > 0 ? pocPhases : [
                      { id: '1', key: 'poc_coleta_amostra', nome: 'COLETA DE AMOSTRA / ACESSO', ordem: 1, grupo_fase: 'fase_poc' as const },
                      { id: '2', key: 'poc_processamento', nome: 'AUDITORIA DA AMOSTRA (AS-IS)', ordem: 2, grupo_fase: 'fase_poc' as const },
                      { id: '3', key: 'poc_apresentacao', nome: 'APRESENTAÇÃO DO DIAGNÓSTICO', ordem: 3, grupo_fase: 'fase_poc' as const }
                    ]).map((f, idx) => {
                      const stepIndex = idx + 1;
                      const stepKey = String(stepIndex);
                      const isCompleted = isPocConverted || currentStepNum > stepIndex;
                      const isCurrent = !isPocConverted && currentStepNum === stepIndex;

                      const hasNotes = Boolean(pipe?.observacoes_etapas?.[stepKey]);
                      const hasPath = Boolean(pipe?.caminhos_rede_etapas?.[stepKey]);
                      const customResp = pipe?.responsaveis_etapas?.[stepKey];
                      const respPrincipalMember = members.find(m => m.id === customResp?.principal_id);

                      return (
                        <div
                          key={f.id || f.key}
                          onClick={() => openPocStepModal(client, f, stepIndex)}
                          className={cn(
                            "p-3.5 rounded-2xl border flex flex-col justify-between gap-3 transition-all cursor-pointer group hover:shadow-md relative overflow-hidden",
                            isCompleted ? "bg-emerald-50/70 border-emerald-200 text-emerald-950 hover:bg-emerald-50" :
                            isCurrent ? "bg-white border-amber-400 text-amber-950 ring-2 ring-amber-200 shadow-xs" :
                            "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div className={cn(
                                "w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 shadow-2xs",
                                isCompleted ? "bg-emerald-600 text-white" :
                                isCurrent ? "bg-amber-500 text-white" :
                                "bg-slate-200 text-slate-600"
                              )}>
                                {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : stepIndex}
                              </div>
                              <div>
                                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Etapa {stepIndex}</span>
                                <h4 className="text-xs font-bold text-slate-900 leading-snug mt-0.5">{f.nome}</h4>
                              </div>
                            </div>
                            
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openPocStepModal(client, f, stepIndex);
                              }}
                              className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50 transition-colors shrink-0 cursor-pointer"
                              title="Editar notas, arquivos e responsáveis"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Badges de Atribuição e Anexos */}
                          <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-100/80 text-[10px]">
                            {respPrincipalMember ? (
                              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 flex items-center gap-1">
                                <User className="w-3 h-3 text-indigo-500" />
                                {respPrincipalMember.nome.split(' ')[0]}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 font-medium">Sem responsável</span>
                            )}

                            {hasNotes && (
                              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200 flex items-center gap-1" title="Notas cadastradas">
                                <FileText className="w-3 h-3 text-blue-500" />
                                Notas
                              </span>
                            )}

                            {hasPath && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold border border-amber-200 flex items-center gap-1" title="Pasta de rede vinculada">
                                <Folder className="w-3 h-3 text-amber-600" />
                                Arquivos
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Conversão de POC para Cliente Recorrente */}
      {convertingClient && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-200 relative flex flex-col gap-5">
            <button
              onClick={() => setConvertingClient(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shadow-2xs">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-emerald-700 uppercase bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Fechamento Comercial
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-0.5">
                  Converter POC em Recorrência
                </h3>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col gap-1">
              <span className="text-xs font-bold text-slate-800">{convertingClient.razao_social}</span>
              <span className="text-xs text-slate-500 font-mono">CNPJ: {convertingClient.cnpj}</span>
              <span className="text-xs text-slate-500">Segmento: {convertingClient.segmento}</span>
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Selecione as Fases Contratadas pelo Cliente:
              </label>

              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setFase1Contracted(!fase1Contracted)}
                  className={cn(
                    "p-3 rounded-2xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer",
                    fase1Contracted
                      ? "bg-indigo-50/90 border-indigo-300 ring-2 ring-indigo-100 text-indigo-900"
                      : "bg-slate-50 border-slate-200 text-slate-400 opacity-60"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Fase 1</span>
                    {fase1Contracted && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                  </div>
                  <span className="text-[11px] font-medium">Diagnóstico</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFase2Contracted(!fase2Contracted)}
                  className={cn(
                    "p-3 rounded-2xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer",
                    fase2Contracted
                      ? "bg-blue-50/90 border-blue-300 ring-2 ring-blue-100 text-blue-900"
                      : "bg-slate-50 border-slate-200 text-slate-400 opacity-60"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Fase 2</span>
                    {fase2Contracted && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                  </div>
                  <span className="text-[11px] font-medium">Plano Ação</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFase3Contracted(!fase3Contracted)}
                  className={cn(
                    "p-3 rounded-2xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer",
                    fase3Contracted
                      ? "bg-emerald-50/90 border-emerald-300 ring-2 ring-emerald-100 text-emerald-900"
                      : "bg-slate-50 border-slate-200 text-slate-400 opacity-60"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Fase 3</span>
                    {fase3Contracted && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  </div>
                  <span className="text-[11px] font-medium">Governança</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConvertingClient(null)}
                className="flex-1 h-11 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={convertingLoading}
                onClick={handleExecuteConversion}
                className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                {convertingLoading ? (
                  <Clock className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Confirmar Conversão
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes da Etapa da POC (Notas, Arquivos, Responsáveis) */}
      {stepModalOpen && stepModalClient && stepModalPhase && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 w-full max-w-xl shadow-2xl border border-slate-200 relative flex flex-col gap-5 max-h-[90vh] overflow-y-auto scrollbar-thin">
            <button
              onClick={() => setStepModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Cabeçalho do Modal */}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300">
                  Etapa {stepModalStepNum} da POC
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-900 text-white">
                  {stepModalPhase.nome}
                </span>
              </div>
              <h3 className="text-lg font-black text-slate-900 mt-2">
                {stepModalClient.razao_social}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                CNPJ: {stepModalClient.cnpj} • Adicione notas, links de arquivos de rede e defina os responsáveis por esta etapa da amostragem.
              </p>
            </div>

            {/* Selector de Status Visual da Etapa */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">Status Visual da Etapa</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setStepModalStatus('cinza')}
                  className={cn(
                    "p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all",
                    stepModalStatus === 'cinza'
                      ? "bg-slate-800 text-white border-slate-900 shadow-2xs"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  )}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                  Pendente
                </button>

                <button
                  type="button"
                  onClick={() => setStepModalStatus('amarelo')}
                  className={cn(
                    "p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all",
                    stepModalStatus === 'amarelo'
                      ? "bg-amber-500 text-white border-amber-600 shadow-2xs"
                      : "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"
                  )}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  Em Andamento
                </button>

                <button
                  type="button"
                  onClick={() => setStepModalStatus('verde')}
                  className={cn(
                    "p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all",
                    stepModalStatus === 'verde'
                      ? "bg-emerald-600 text-white border-emerald-700 shadow-2xs"
                      : "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100"
                  )}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  Concluído
                </button>

                <button
                  type="button"
                  onClick={() => setStepModalStatus('vermelho')}
                  className={cn(
                    "p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all",
                    stepModalStatus === 'vermelho'
                      ? "bg-red-600 text-white border-red-700 shadow-2xs"
                      : "bg-red-50 border-red-200 text-red-800 hover:bg-red-100"
                  )}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  Bloqueio
                </button>
              </div>
            </div>

            {/* Seção de Responsáveis */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-600" />
                  Responsável Principal
                </label>
                <select
                  value={stepModalPrincipalId}
                  onChange={(e) => setStepModalPrincipalId(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all cursor-pointer font-medium"
                >
                  <option value="">Nenhum atribuído</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome} ({m.cargo})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                  Responsável Backup
                </label>
                <select
                  value={stepModalBackupId}
                  onChange={(e) => setStepModalBackupId(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all cursor-pointer font-medium"
                >
                  <option value="">Nenhum atribuído</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome} ({m.cargo})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Caminho de Rede / Link de Arquivos */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-amber-600" />
                Caminho de Rede / Pasta de Arquivos
              </label>
              <input
                type="text"
                value={stepModalPath}
                onChange={(e) => setStepModalPath(e.target.value)}
                placeholder="Ex: \\servidor\amostras_sped\cliente_xyz"
                className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
              />
            </div>

            {/* Observações e Notas */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                Observações e Notas da Etapa
              </label>
              <textarea
                rows={4}
                value={stepModalNotes}
                onChange={(e) => setStepModalNotes(e.target.value)}
                placeholder="Digite detalhes técnicos da amostra, apontamentos ou pendências deste passo da POC..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all resize-none"
              />
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStepModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={savingStepDetail}
                onClick={handleSavePocStepDetail}
                className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {savingStepDetail ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
