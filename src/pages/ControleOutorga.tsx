import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Award, 
  Search, 
  Filter, 
  Calendar, 
  Building2, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  Edit3, 
  Save, 
  X, 
  ExternalLink, 
  RefreshCw, 
  Loader2,
  FileCheck,
  ShieldCheck,
  Tag,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/logger';
import { useAuth } from '../contexts/AuthContext';
import { Client, WorkflowPipeline, REGIMES_CONFIG, getRegimeFromSegmento, EtapaColorStatus, normalizeStepStatus } from '../types';
import { cn, formatCNPJ } from '../lib/utils';

export type OutorgaTabType = 'sped' | 'apuracao' | 'as_is';
export type SortFieldType = 'situacao' | 'razao_social' | 'dataLiberacao' | 'dataValidade' | 'diasVencimento';
export type SortDirectionType = 'asc' | 'desc';

interface OutorgaRow {
  client: Client;
  pipeline?: WorkflowPipeline;
  dataLiberacao?: string;
  dataValidade?: string;
  diasVencimento: number | null;
  situacao: 'ativa' | 'expirado' | 'pendente';
  statusEtapa: EtapaColorStatus;
}

const SITUACAO_PRIORITY: Record<'pendente' | 'expirado' | 'ativa', number> = {
  pendente: 1,
  expirado: 2,
  ativa: 3
};

export default function ControleOutorga() {
  const { getUserName } = useAuth();
  const navigate = useNavigate();

  const [clients, setClients] = useState<Client[]>([]);
  const [pipelines, setPipelines] = useState<WorkflowPipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filtros
  const [activeTab, setActiveTab] = useState<OutorgaTabType>('sped');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('todos');
  const [selectedRegimeFilter, setSelectedRegimeFilter] = useState<string>('todos');

  // Ordenação (Padrão: Situação - Pendente, Expirado, Ativa)
  const [sortField, setSortField] = useState<SortFieldType>('situacao');
  const [sortDirection, setSortDirection] = useState<SortDirectionType>('asc');

  // Modal de Edição de Outorga
  const [editingRow, setEditingRow] = useState<OutorgaRow | null>(null);
  const [editLiberacao, setEditLiberacao] = useState('');
  const [editValidade, setEditValidade] = useState('');
  const [editStatusEtapa, setEditStatusEtapa] = useState<EtapaColorStatus>('pendente');
  const [savingEdit, setSavingEdit] = useState(false);

  // ────────────────────────────────────────────────
  // Fetch de dados
  // ────────────────────────────────────────────────
  const fetchData = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      // 1. Clientes (Apenas Clientes Recorrentes - POCs não entram neste módulo)
      const { data: clientsData, error: clientErr } = await supabase
        .from('clients')
        .select('*')
        .order('razao_social');
      if (clientErr) throw clientErr;

      const recurrentClientsOnly = (clientsData || []).filter(c => c.tipo_contrato !== 'poc');
      setClients(recurrentClientsOnly);

      // 2. Pipelines da Fase 1 (Diagnóstico)
      const { data: pipeData, error: pipeErr } = await supabase
        .from('workflow_pipelines')
        .select('*')
        .eq('fase_grupo', 'fase_1');
      if (pipeErr) throw pipeErr;
      setPipelines(pipeData || []);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Erro ao carregar dados de outorga:', message);
    } finally {
      if (!isSilent) setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ────────────────────────────────────────────────
  // Cálculo de Dias Vencimento
  // ────────────────────────────────────────────────
  const calculateDaysToExpiration = (validadeStr?: string | null): number | null => {
    if (!validadeStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [year, month, day] = validadeStr.split('-').map(Number);
    if (!year || !month || !day) return null;

    const targetDate = new Date(year, month - 1, day);
    targetDate.setHours(0, 0, 0, 0);

    const diffTime = targetDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Mapeamento dos dados para exibição por empresa
  const outorgaRows = useMemo<OutorgaRow[]>(() => {
    return clients.map(client => {
      const pipe = pipelines.find(p => p.client_id === client.id && p.fase_grupo === 'fase_1');
      const stepKey = activeTab === 'sped' ? '1' : activeTab === 'apuracao' ? '2' : '1';

      let dataLiberacao = '';
      let dataValidade = '';

      if (activeTab === 'as_is') {
        dataLiberacao = pipe?.start_as_is || '';
        dataValidade = pipe?.datas_etapas?.['1']?.data_fim || '';
      } else {
        const stepDates = pipe?.datas_etapas?.[stepKey];
        dataLiberacao = stepDates?.data_inicio || '';
        dataValidade = stepDates?.data_fim || '';
      }

      const rawStatus = pipe?.status_etapas?.[stepKey];
      const statusEtapa = normalizeStepStatus(rawStatus);

      const dias = calculateDaysToExpiration(dataValidade);

      let situacao: 'ativa' | 'expirado' | 'pendente' = 'pendente';
      if (dias !== null) {
        if (dias >= 0) situacao = 'ativa';
        else situacao = 'expirado';
      }

      return {
        client,
        pipeline: pipe,
        dataLiberacao,
        dataValidade,
        diasVencimento: dias,
        situacao,
        statusEtapa
      };
    });
  }, [clients, pipelines, activeTab]);

  // Estatísticas Rápidas (KPIs)
  const stats = useMemo(() => {
    const total = outorgaRows.length;
    const ativas = outorgaRows.filter(r => r.situacao === 'ativa').length;
    const expiradas = outorgaRows.filter(r => r.situacao === 'expirado').length;
    const vencendoBreve = outorgaRows.filter(r => r.diasVencimento !== null && r.diasVencimento >= 0 && r.diasVencimento <= 30).length;
    const pendentes = outorgaRows.filter(r => r.situacao === 'pendente').length;

    return { total, ativas, expiradas, vencendoBreve, pendentes };
  }, [outorgaRows]);

  // Alternar Ordenação ao clicar no cabeçalho
  const handleSort = (field: SortFieldType) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Renderizar ícone de ordenação no cabeçalho
  const renderSortIcon = (field: SortFieldType) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 group-hover/th:opacity-100 transition-opacity" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-indigo-600 font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-indigo-600 font-bold" />
    );
  };

  // Filtros aplicados e Ordenação à tabela
  const filteredAndSortedRows = useMemo(() => {
    // 1. Filtrar
    const filtered = outorgaRows.filter(row => {
      // Busca
      const search = searchTerm.toLowerCase().trim();
      if (search) {
        const matchRazao = row.client.razao_social.toLowerCase().includes(search);
        const matchCNPJ = row.client.cnpj.includes(search);
        const matchGrupo = row.client.nome_grupo?.toLowerCase().includes(search);
        if (!matchRazao && !matchCNPJ && !matchGrupo) return false;
      }

      // Status
      if (selectedStatusFilter === 'ativas' && row.situacao !== 'ativa') return false;
      if (selectedStatusFilter === 'expiradas' && row.situacao !== 'expirado') return false;
      if (selectedStatusFilter === 'vencendo' && (row.diasVencimento === null || row.diasVencimento < 0 || row.diasVencimento > 30)) return false;
      if (selectedStatusFilter === 'pendentes' && row.situacao !== 'pendente') return false;

      // Regime
      if (selectedRegimeFilter !== 'todos') {
        const cRegime = row.client.regime || getRegimeFromSegmento(row.client.segmento);
        if (cRegime !== selectedRegimeFilter) return false;
      }

      return true;
    });

    // 2. Ordenar
    return filtered.sort((a, b) => {
      let result = 0;

      if (sortField === 'situacao') {
        const priorityA = SITUACAO_PRIORITY[a.situacao] || 99;
        const priorityB = SITUACAO_PRIORITY[b.situacao] || 99;
        result = priorityA - priorityB;
        if (result === 0) {
          // Secundário: Dias Vencimento
          if (a.diasVencimento !== null && b.diasVencimento !== null) {
            result = a.diasVencimento - b.diasVencimento;
          } else if (a.diasVencimento !== null) {
            result = -1;
          } else if (b.diasVencimento !== null) {
            result = 1;
          } else {
            result = a.client.razao_social.localeCompare(b.client.razao_social);
          }
        }
      } else if (sortField === 'razao_social') {
        result = a.client.razao_social.localeCompare(b.client.razao_social);
      } else if (sortField === 'dataLiberacao') {
        const dateA = a.dataLiberacao || '9999-12-31';
        const dateB = b.dataLiberacao || '9999-12-31';
        result = dateA.localeCompare(dateB);
      } else if (sortField === 'dataValidade') {
        const dateA = a.dataValidade || '9999-12-31';
        const dateB = b.dataValidade || '9999-12-31';
        result = dateA.localeCompare(dateB);
      } else if (sortField === 'diasVencimento') {
        const valA = a.diasVencimento !== null ? a.diasVencimento : 999999;
        const valB = b.diasVencimento !== null ? b.diasVencimento : 999999;
        result = valA - valB;
      }

      return sortDirection === 'asc' ? result : -result;
    });
  }, [outorgaRows, searchTerm, selectedStatusFilter, selectedRegimeFilter, sortField, sortDirection]);

  // ────────────────────────────────────────────────
  // Abrir Modal de Edição
  // ────────────────────────────────────────────────
  const handleOpenEdit = (row: OutorgaRow) => {
    setEditingRow(row);
    setEditLiberacao(row.dataLiberacao || '');
    setEditValidade(row.dataValidade || '');
    setEditStatusEtapa(row.statusEtapa || 'pendente');
  };

function getErrorMessage(err: unknown): string {
  if (!err) return 'Erro desconhecido';
  if (typeof err === 'string') return err;
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, any>;
    if (typeof e.message === 'string' && e.message) return e.message;
    if (typeof e.details === 'string' && e.details) return e.details;
    if (typeof e.error_description === 'string' && e.error_description) return e.error_description;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

  // ────────────────────────────────────────────────
  // Salvar Edição no Supabase (workflow_pipelines)
  // ────────────────────────────────────────────────
  const handleSaveEdit = async () => {
    if (!editingRow) return;
    try {
      setSavingEdit(true);
      const { client } = editingRow;
      const stepKey = activeTab === 'sped' ? '1' : activeTab === 'apuracao' ? '2' : '1';

      // 1. Buscar a versão mais recente do pipeline Fase 1 diretamente do banco de dados
      const { data: existingPipes, error: fetchErr } = await supabase
        .from('workflow_pipelines')
        .select('*')
        .eq('client_id', client.id)
        .eq('fase_grupo', 'fase_1');

      if (fetchErr) throw fetchErr;

      const targetPipe = existingPipes && existingPipes.length > 0 ? existingPipes[0] : null;

      const currentDates = targetPipe?.datas_etapas || {};
      const currentStatuses = targetPipe?.status_etapas || {};

      const updatedDates = {
        ...currentDates,
        [stepKey]: {
          data_inicio: editLiberacao || null,
          data_fim: editValidade || null
        }
      };

      const updatedStatuses = {
        ...currentStatuses,
        [stepKey]: editStatusEtapa
      };

      if (targetPipe) {
        // Atualizar pipeline existente
        const updatePayload: Record<string, any> = {
          datas_etapas: updatedDates,
          status_etapas: updatedStatuses,
          updated_at: new Date().toISOString()
        };

        if (activeTab === 'as_is') {
          updatePayload.start_as_is = editLiberacao || null;
        }

        const { error: upErr } = await supabase
          .from('workflow_pipelines')
          .update(updatePayload)
          .eq('id', targetPipe.id);

        if (upErr) throw upErr;
      } else {
        // Criar novo pipeline Fase 1 se não existir
        const insertPayload: Record<string, any> = {
          client_id: client.id,
          fase_grupo: 'fase_1',
          etapa_atual: 1,
          status: 'em_andamento',
          datas_etapas: updatedDates,
          status_etapas: updatedStatuses,
          mensagem_info: 'Pipeline iniciado pelo Controle de Outorga'
        };

        if (activeTab === 'as_is') {
          insertPayload.start_as_is = editLiberacao || null;
        }

        const { error: insErr } = await supabase
          .from('workflow_pipelines')
          .insert(insertPayload);

        if (insErr) throw insErr;
      }

      await logActivity({
        titulo: 'Atualização de Outorga',
        descricao: `Outorga (${activeTab.toUpperCase()}) atualizada para ${client.razao_social}: Liberação (${editLiberacao || 'N/I'}) | Validade (${editValidade || 'N/I'})`,
        tipo_log: 'info',
        client_id: client.id,
        usuario_nome: getUserName()
      });

      setEditingRow(null);
      await fetchData(true);
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      console.error('Erro ao salvar informações de Outorga:', err);
      alert('Erro ao salvar informações de Outorga: ' + message);
    } finally {
      setSavingEdit(false);
    }
  };

  // Navegar direto para o Cliente Recorrente na Fase 1
  const handleNavigateToWorkflow = (clientId: string) => {
    const stepNum = activeTab === 'apuracao' ? 2 : 1;
    navigate('/fluxo-de-trabalho', {
      state: {
        clientId,
        grupo: 'fase_1',
        stepNum
      }
    });
  };

  return (
    <div className="flex flex-col w-full gap-6 relative p-2 animate-in fade-in duration-300 pb-12">
      {/* Cabeçalho Hero com KPIs idêntico ao módulo Cliente Recorrente */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner shrink-0">
            <Award className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 uppercase tracking-wider">
                Clientes Recorrentes — Fase 1
              </span>
            </div>
            <h1 className="text-2xl font-black text-white mt-1 tracking-tight">
              Controle de Outorga
            </h1>
            <p className="text-xs text-indigo-100/80 mt-1 max-w-xl">
              Gerencie a liberação, vigência e vencimento das outorgas de todas as empresas recorrentes (POCs não incluídas).
            </p>
          </div>
        </div>

        {/* Banner de KPIs estilo Cliente Recorrente */}
        <div className="flex flex-col gap-3 relative z-10 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/10">
            {/* Metric 1: Total Empresas */}
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider">Empresas</span>
              <span className="text-xl font-black text-white mt-0.5">{stats.total}</span>
              <span className="text-[10px] text-slate-400">Recorrentes</span>
            </div>

            {/* Metric 2: Ativas */}
            <div className="flex flex-col border-l border-white/10 pl-3">
              <span className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider">Ativas</span>
              <span className="text-xl font-black text-emerald-400 mt-0.5">{stats.ativas}</span>
              <span className="text-[10px] text-emerald-300/80">
                {stats.total > 0 ? `${Math.round((stats.ativas / stats.total) * 100)}%` : '0%'}
              </span>
            </div>

            {/* Metric 3: Vencendo (30d) */}
            <div className="flex flex-col border-l border-white/10 pl-3">
              <span className="text-[10px] uppercase font-bold text-amber-300 tracking-wider">Vencendo (30d)</span>
              <span className="text-xl font-black text-amber-300 mt-0.5">{stats.vencendoBreve}</span>
              <span className="text-[10px] text-amber-300/80">Atenção</span>
            </div>

            {/* Metric 4: Expiradas */}
            <div className="flex flex-col border-l border-white/10 pl-3">
              <span className="text-[10px] uppercase font-bold text-rose-300 tracking-wider">Expiradas</span>
              <span className="text-xl font-black text-rose-400 mt-0.5">{stats.expiradas}</span>
              <span className="text-[10px] text-rose-300/80">Vencidas</span>
            </div>

            {/* Metric 5: Pendentes */}
            <div className="flex flex-col border-l border-white/10 pl-3">
              <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider">Pendentes</span>
              <span className="text-xl font-black text-slate-300 mt-0.5">{stats.pendentes}</span>
              <span className="text-[10px] text-slate-400">Sem data</span>
            </div>
          </div>

          {/* Botão de Atualizar dados no Header */}
          <div className="flex items-center justify-end">
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-xl text-xs font-semibold backdrop-blur-md transition-colors cursor-pointer disabled:opacity-50"
              title="Atualizar dados"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 text-indigo-300", refreshing && "animate-spin")} />
              <span>Atualizar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Abas e Filtros de Pesquisa */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col gap-4">
        {/* Abas para seleção do tipo de Outorga */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setActiveTab('sped')}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
                activeTab === 'sped'
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <FileCheck className="w-4 h-4" />
              <span>Outorga SPED (Etapa 1)</span>
            </button>

            <button
              onClick={() => setActiveTab('apuracao')}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
                activeTab === 'apuracao'
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Outorga Apuração Assistida (Etapa 2)</span>
            </button>

            <button
              onClick={() => setActiveTab('as_is')}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
                activeTab === 'as_is'
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Calendar className="w-4 h-4" />
              <span>Confirmação Start AS-IS</span>
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
            <span className="bg-slate-100 text-slate-700 font-semibold px-2.5 py-1 rounded-lg border border-slate-200">
              Ordenação Padrão: Pendente → Expirado → Ativa
            </span>
            <span>
              Exibindo <strong className="text-slate-800">{filteredAndSortedRows.length}</strong> de {outorgaRows.length} empresas
            </span>
          </div>
        </div>

        {/* Linha de Busca e Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Busca */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por Razão Social, CNPJ ou Grupo..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
            />
          </div>

          {/* Filtro por Situação */}
          <div className="relative">
            <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-indigo-500 outline-none cursor-pointer"
            >
              <option value="todos">Todas as Situações</option>
              <option value="pendentes">Somente Pendentes (Pré-definição)</option>
              <option value="expiradas">Somente Expiradas</option>
              <option value="vencendo">Vencendo nos Próximos 30 dias</option>
              <option value="ativas">Somente Ativas</option>
            </select>
          </div>

          {/* Filtro por Regime */}
          <div className="relative">
            <Tag className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              value={selectedRegimeFilter}
              onChange={(e) => setSelectedRegimeFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-indigo-500 outline-none cursor-pointer"
            >
              <option value="todos">Todos os Regimes</option>
              <option value="regular">Regime Regular (Normal)</option>
              <option value="especifico">Regimes Específicos</option>
              <option value="diferenciado">Regimes Diferenciados</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabela Principal com Ordenação Interativa & Rolagem para ~8 empresas */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-500 gap-3">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            <span className="text-xs font-medium">Carregando controle de outorgas...</span>
          </div>
        ) : filteredAndSortedRows.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Building2 className="w-10 h-10 text-slate-300 stroke-1" />
            <p className="text-sm font-semibold text-slate-600 mt-1">Nenhuma empresa encontrada</p>
            <p className="text-xs text-slate-400">Tente ajustar os termos de busca ou os filtros aplicados.</p>
          </div>
        ) : (
          /* Container com altura máxima (~8 linhas visíveis) e rolagem suave */
          <div className="max-h-[520px] overflow-y-auto scrollbar-thin">
            <table className="w-full text-left border-collapse relative">
              <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200 shadow-xs">
                <tr className="text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none">
                  {/* Header Razão Social */}
                  <th 
                    onClick={() => handleSort('razao_social')}
                    className="py-3.5 px-4 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors group/th"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Razão Social / CNPJ</span>
                      {renderSortIcon('razao_social')}
                    </div>
                  </th>

                  {/* Header Regime / Segmento */}
                  <th className="py-3.5 px-4 bg-slate-50">Regime / Segmento</th>

                  {/* Header Data Liberação */}
                  <th 
                    onClick={() => handleSort('dataLiberacao')}
                    className="py-3.5 px-4 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors group/th"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Data Liberação</span>
                      {renderSortIcon('dataLiberacao')}
                    </div>
                  </th>

                  {/* Header Validade */}
                  <th 
                    onClick={() => handleSort('dataValidade')}
                    className="py-3.5 px-4 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors group/th"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Validade</span>
                      {renderSortIcon('dataValidade')}
                    </div>
                  </th>

                  {/* Header Dias Vencimento */}
                  <th 
                    onClick={() => handleSort('diasVencimento')}
                    className="py-3.5 px-4 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors group/th"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Dias Vencimento</span>
                      {renderSortIcon('diasVencimento')}
                    </div>
                  </th>

                  {/* Header Situação (Default Active Sort) */}
                  <th 
                    onClick={() => handleSort('situacao')}
                    className="py-3.5 px-4 bg-slate-50 text-center cursor-pointer hover:bg-slate-100 transition-colors group/th"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Situação</span>
                      {renderSortIcon('situacao')}
                    </div>
                  </th>

                  {/* Header Ações */}
                  <th className="py-3.5 px-4 bg-slate-50 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredAndSortedRows.map((row) => {
                  const cRegime = row.client.regime || getRegimeFromSegmento(row.client.segmento);
                  const regimeMeta = REGIMES_CONFIG[cRegime];

                  return (
                    <tr 
                      key={row.client.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Razão Social & CNPJ */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                            {row.client.razao_social}
                            {row.client.nome_grupo && (
                              <span className="text-[10px] font-normal text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                {row.client.nome_grupo}
                              </span>
                            )}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono mt-0.5">
                            {formatCNPJ(row.client.cnpj)}
                          </span>
                        </div>
                      </td>

                      {/* Regime / Segmento */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 max-w-[200px]">
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border w-fit",
                            regimeMeta?.badgeBg || 'bg-slate-50',
                            regimeMeta?.badgeText || 'text-slate-600',
                            regimeMeta?.badgeBorder || 'border-slate-200'
                          )}>
                            {regimeMeta?.shortLabel || cRegime}
                          </span>
                          <span className="text-[11px] text-slate-500 truncate" title={row.client.segmento}>
                            {row.client.segmento}
                          </span>
                        </div>
                      </td>

                      {/* Data Liberação */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {row.dataLiberacao ? (
                          <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                            <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span>{new Date(row.dataLiberacao + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Não informada</span>
                        )}
                      </td>

                      {/* Validade */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {row.dataValidade ? (
                          <div className="flex items-center gap-1.5 text-slate-800 font-semibold">
                            <Calendar className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                            <span>{new Date(row.dataValidade + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Não informada</span>
                        )}
                      </td>

                      {/* Dias Vencimento */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {row.diasVencimento !== null ? (
                          <span className={cn(
                            "font-extrabold text-xs px-2.5 py-1 rounded-lg border inline-flex items-center gap-1",
                            row.diasVencimento < 0 
                              ? "bg-rose-50 text-rose-700 border-rose-200" 
                              : row.diasVencimento <= 30 
                              ? "bg-amber-50 text-amber-800 border-amber-200" 
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          )}>
                            <Clock className="w-3 h-3 shrink-0" />
                            {row.diasVencimento < 0 
                              ? `Vencido há ${Math.abs(row.diasVencimento)} dia(s)` 
                              : row.diasVencimento === 0 
                              ? 'Vence hoje!' 
                              : `${row.diasVencimento} dia(s)`}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">—</span>
                        )}
                      </td>

                      {/* Situação */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {row.situacao === 'ativa' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Ativa
                          </span>
                        ) : row.situacao === 'expirado' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200 shadow-2xs">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            Expirado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            Pendente
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(row)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition-colors cursor-pointer"
                            title="Editar datas da Outorga"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleNavigateToWorkflow(row.client.id)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors flex items-center gap-1 cursor-pointer"
                            title="Ver esteira da empresa em Cliente Recorrente"
                          >
                            <span>Fase 1</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Edição de Outorga */}
      {editingRow && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-slate-200 relative flex flex-col gap-5">
            <button
              onClick={() => setEditingRow(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100 w-fit">
                <Award className="w-3.5 h-3.5" />
                <span>Outorga: {activeTab === 'sped' ? 'SPED (Etapa 1)' : activeTab === 'apuracao' ? 'Apuração Assistida (Etapa 2)' : 'Start AS-IS'}</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-2 truncate">
                {editingRow.client.razao_social}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Atualize a data de liberação e validade para sincronizar com a Fase 1 da esteira.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Data Liberação</label>
                <input
                  type="date"
                  value={editLiberacao}
                  onChange={(e) => setEditLiberacao(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Validade da Outorga</label>
                <input
                  type="date"
                  value={editValidade}
                  onChange={(e) => setEditValidade(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Status da Etapa no Fluxo</label>
                <select
                  value={editStatusEtapa}
                  onChange={(e) => setEditStatusEtapa(e.target.value as EtapaColorStatus)}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-indigo-500 outline-none cursor-pointer"
                >
                  <option value="pendente">Pendente</option>
                  <option value="em_andamento">Em Andamento</option>
                  <option value="concluido">Concluído</option>
                  <option value="na">Não se aplica</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setEditingRow(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Salvar Outorga</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
