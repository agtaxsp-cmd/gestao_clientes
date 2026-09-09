import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award,
  Search,
  Filter,
  Building2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Edit3,
  Save,
  X,
  ExternalLink,
  Loader2,
  FileCheck,
  ShieldCheck,
  Tag,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Slash
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/logger';
import { useAuth } from '../contexts/AuthContext';
import { Client, WorkflowPipeline, REGIMES_CONFIG, getRegimeFromSegmento, EtapaColorStatus, normalizeStepStatus } from '../types';
import { cn, formatCNPJ } from '../lib/utils';

export type SortFieldType = 'razao_social' | 'regime';
export type SortDirectionType = 'asc' | 'desc';

interface OutorgaRow {
  client: Client;
  pipeline?: WorkflowPipeline;
  stepKey: string;
  dataLiberacao?: string;
  dataValidade?: string;
  diasVencimento: number | null;
  situacao: 'ativa' | 'expirado' | 'pendente' | 'na';
  statusEtapa: EtapaColorStatus;
}

interface ConsolidatedRow {
  client: Client;
  pipeline?: WorkflowPipeline;
  sped: OutorgaRow;
  apuracao: OutorgaRow;
}

export default function ControleOutorga() {
  const { getUserName } = useAuth();
  const navigate = useNavigate();

  const [clients, setClients] = useState<Client[]>([]);
  const [pipelines, setPipelines] = useState<WorkflowPipeline[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('todos');
  const [selectedRegimeFilter, setSelectedRegimeFilter] = useState<string>('todos');

  // Ordenação
  const [sortField, setSortField] = useState<SortFieldType>('razao_social');
  const [sortDirection, setSortDirection] = useState<SortDirectionType>('asc');

  // Modal de Edição de Outorga
  const [editingRow, setEditingRow] = useState<OutorgaRow | null>(null);
  const [editLiberacao, setEditLiberacao] = useState('');
  const [editValidade, setEditValidade] = useState('');
  const [editStatusEtapa, setEditStatusEtapa] = useState<EtapaColorStatus>('pendente');
  const [savingEdit, setSavingEdit] = useState(false);

  // Fetch de dados
  const fetchData = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);

      const { data: clientsData, error: clientErr } = await supabase
        .from('clients')
        .select('*')
        .order('razao_social');
      if (clientErr) throw clientErr;

      const recurrentClientsOnly = (clientsData || []).filter(c => c.tipo_contrato !== 'poc');
      setClients(recurrentClientsOnly);

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
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Cálculo de Dias Vencimento
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

  // Obter a chave de etapa de Apuração para o cliente
  const getApuracaoStepKey = (client: Client, pipe?: WorkflowPipeline): string => {
    if (pipe?.datas_etapas?.['3'] || pipe?.status_etapas?.['3']) return '3';
    if (pipe?.datas_etapas?.['4'] || pipe?.status_etapas?.['4']) return '4';
    if (pipe?.datas_etapas?.['2'] || pipe?.status_etapas?.['2']) return '2';
    const cRegime = client.regime || getRegimeFromSegmento(client.segmento);
    return cRegime === 'diferenciado' ? '3' : '4';
  };

  // Mapeamento dos dados consolidados de SPED e Apuração para cada cliente
  const consolidatedList = useMemo<ConsolidatedRow[]>(() => {
    return clients.map(client => {
      const pipe = pipelines.find(p => p.client_id === client.id && p.fase_grupo === 'fase_1');

      // 1. SPED (Etapa 1)
      const spedStepKey = '1';
      const spedDates = pipe?.datas_etapas?.[spedStepKey];
      const spedLib = spedDates?.data_inicio || '';
      const spedVal = spedDates?.data_fim || '';
      const spedRawStatus = pipe?.status_etapas?.[spedStepKey];
      const spedStatusEtapa = normalizeStepStatus(spedRawStatus);
      const spedDias = calculateDaysToExpiration(spedVal);

      let spedSituacao: 'ativa' | 'expirado' | 'pendente' | 'na' = 'pendente';
      if (spedStatusEtapa === 'na') {
        spedSituacao = 'na';
      } else if (spedDias !== null) {
        if (spedDias >= 0) spedSituacao = 'ativa';
        else spedSituacao = 'expirado';
      }

      const spedRow: OutorgaRow = {
        client,
        pipeline: pipe,
        stepKey: spedStepKey,
        dataLiberacao: spedLib,
        dataValidade: spedVal,
        diasVencimento: spedDias,
        situacao: spedSituacao,
        statusEtapa: spedStatusEtapa
      };

      // 2. Apuração Assistida (Etapa 3/4/2)
      const apurStepKey = getApuracaoStepKey(client, pipe);
      const apurDates = pipe?.datas_etapas?.[apurStepKey];
      const apurLib = apurDates?.data_inicio || '';
      const apurVal = apurDates?.data_fim || '';
      const apurRawStatus = pipe?.status_etapas?.[apurStepKey];
      const apurStatusEtapa = normalizeStepStatus(apurRawStatus);
      const apurDias = calculateDaysToExpiration(apurVal);

      let apurSituacao: 'ativa' | 'expirado' | 'pendente' | 'na' = 'pendente';
      if (apurStatusEtapa === 'na') {
        apurSituacao = 'na';
      } else if (apurDias !== null) {
        if (apurDias >= 0) apurSituacao = 'ativa';
        else apurSituacao = 'expirado';
      }

      const apurRow: OutorgaRow = {
        client,
        pipeline: pipe,
        stepKey: apurStepKey,
        dataLiberacao: apurLib,
        dataValidade: apurVal,
        diasVencimento: apurDias,
        situacao: apurSituacao,
        statusEtapa: apurStatusEtapa
      };

      return {
        client,
        pipeline: pipe,
        sped: spedRow,
        apuracao: apurRow
      };
    });
  }, [clients, pipelines]);

  // Estatísticas Rápidas Globais (KPIs Banner)
  const stats = useMemo(() => {
    let ativas = 0;
    let vencendoBreve = 0;
    let expiradas = 0;
    let pendentes = 0;
    let naoSeAplica = 0;

    consolidatedList.forEach(row => {
      [row.sped, row.apuracao].forEach(item => {
        if (item.situacao === 'ativa') {
          ativas++;
          if (item.diasVencimento !== null && item.diasVencimento <= 30) {
            vencendoBreve++;
          }
        } else if (item.situacao === 'expirado') {
          expiradas++;
        } else if (item.situacao === 'na') {
          naoSeAplica++;
        } else {
          pendentes++;
        }
      });
    });

    return {
      total: clients.length,
      ativas,
      expiradas,
      vencendoBreve,
      pendentes,
      naoSeAplica
    };
  }, [consolidatedList, clients]);

  // Alternar Ordenação
  const handleSort = (field: SortFieldType) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

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

  // Filtros aplicados à Visão Consolidada
  const filteredConsolidatedRows = useMemo(() => {
    const filtered = consolidatedList.filter(row => {
      const search = searchTerm.toLowerCase().trim();
      if (search) {
        const matchRazao = row.client.razao_social.toLowerCase().includes(search);
        const matchCNPJ = row.client.cnpj.includes(search);
        const matchGrupo = row.client.nome_grupo?.toLowerCase().includes(search);
        if (!matchRazao && !matchCNPJ && !matchGrupo) return false;
      }

      if (selectedStatusFilter === 'ativas' && (row.sped.situacao !== 'ativa' && row.apuracao.situacao !== 'ativa')) return false;
      if (selectedStatusFilter === 'expiradas' && (row.sped.situacao !== 'expirado' && row.apuracao.situacao !== 'expirado')) return false;
      if (selectedStatusFilter === 'vencendo' && (
        (row.sped.diasVencimento === null || row.sped.diasVencimento < 0 || row.sped.diasVencimento > 30 || row.sped.situacao === 'na') &&
        (row.apuracao.diasVencimento === null || row.apuracao.diasVencimento < 0 || row.apuracao.diasVencimento > 30 || row.apuracao.situacao === 'na')
      )) return false;
      if (selectedStatusFilter === 'pendentes' && (row.sped.situacao !== 'pendente' && row.apuracao.situacao !== 'pendente')) return false;
      if (selectedStatusFilter === 'na' && (row.sped.situacao !== 'na' && row.apuracao.situacao !== 'na')) return false;

      if (selectedRegimeFilter !== 'todos') {
        const cRegime = row.client.regime || getRegimeFromSegmento(row.client.segmento);
        if (cRegime !== selectedRegimeFilter) return false;
      }

      return true;
    });

    return filtered.sort((a, b) => {
      let result = 0;
      if (sortField === 'razao_social') {
        result = a.client.razao_social.localeCompare(b.client.razao_social);
      } else if (sortField === 'regime') {
        const regA = a.client.regime || getRegimeFromSegmento(a.client.segmento);
        const regB = b.client.regime || getRegimeFromSegmento(b.client.segmento);
        result = regA.localeCompare(regB);
      }
      return sortDirection === 'asc' ? result : -result;
    });
  }, [consolidatedList, searchTerm, selectedStatusFilter, selectedRegimeFilter, sortField, sortDirection]);

  // Abrir Modal de Edição
  const handleOpenEdit = (row: OutorgaRow) => {
    setEditingRow(row);
    setEditLiberacao(row.dataLiberacao || '');
    setEditValidade(row.dataValidade || '');
    setEditStatusEtapa(row.statusEtapa || 'pendente');
  };

  const getErrorMessage = (err: unknown): string => {
    if (!err) return 'Erro desconhecido';
    if (typeof err === 'string') return err;
    if (typeof err === 'object' && err !== null) {
      const e = err as Record<string, unknown>;
      if (typeof e.message === 'string' && e.message) return e.message;
      if (typeof e.details === 'string' && e.details) return e.details;
    }
    return String(err);
  };

  // Salvar Edição no Supabase (workflow_pipelines)
  const handleSaveEdit = async () => {
    if (!editingRow) return;
    try {
      setSavingEdit(true);
      const { client, stepKey } = editingRow;

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
        const updatePayload: Record<string, unknown> = {
          datas_etapas: updatedDates,
          status_etapas: updatedStatuses,
          updated_at: new Date().toISOString()
        };

        const { error: upErr } = await supabase
          .from('workflow_pipelines')
          .update(updatePayload)
          .eq('id', targetPipe.id);

        if (upErr) throw upErr;
      } else {
        const insertPayload: Record<string, unknown> = {
          client_id: client.id,
          fase_grupo: 'fase_1',
          etapa_atual: 1,
          status: 'em_andamento',
          datas_etapas: updatedDates,
          status_etapas: updatedStatuses,
          mensagem_info: 'Pipeline iniciado pelo Controle de Outorga'
        };

        const { error: insErr } = await supabase
          .from('workflow_pipelines')
          .insert(insertPayload);

        if (insErr) throw insErr;
      }

      await logActivity({
        titulo: 'Atualização de Outorga',
        descricao: `Outorga (${stepKey === '1' ? 'SPED' : 'APURAÇÃO'}) atualizada para ${client.razao_social}: Liberação (${editLiberacao || 'N/I'}) | Validade (${editValidade || 'N/I'}) | Status (${editStatusEtapa})`,
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
  const handleNavigateToWorkflow = (clientId: string, stepNum: number) => {
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
      {/* Cabeçalho Hero com KPIs */}
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

        {/* Banner de KPIs Consolidados */}
        <div className="flex flex-col gap-3 relative z-10 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/10">
            {/* Metric 1: Total Empresas */}
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider">Total</span>
              <span className="text-xl font-black text-white mt-0.5">{stats.total}</span>
              <span className="text-[10px] text-slate-400">Recorrentes</span>
            </div>

            {/* Metric 2: Ativas */}
            <div className="flex flex-col border-l border-white/10 pl-2.5">
              <span className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider">Vigentes</span>
              <span className="text-xl font-black text-emerald-400 mt-0.5">{stats.ativas}</span>
              <span className="text-[10px] text-emerald-300/80">Ativas</span>
            </div>

            {/* Metric 3: Vencendo (30d) */}
            <div className="flex flex-col border-l border-white/10 pl-2.5">
              <span className="text-[10px] uppercase font-bold text-amber-300 tracking-wider">Vencendo</span>
              <span className="text-xl font-black text-amber-300 mt-0.5">{stats.vencendoBreve}</span>
              <span className="text-[10px] text-amber-300/80">Próx. 30d</span>
            </div>

            {/* Metric 4: Expiradas */}
            <div className="flex flex-col border-l border-white/10 pl-2.5">
              <span className="text-[10px] uppercase font-bold text-rose-300 tracking-wider">Expiradas</span>
              <span className="text-xl font-black text-rose-400 mt-0.5">{stats.expiradas}</span>
              <span className="text-[10px] text-rose-300/80">Ação necess.</span>
            </div>

            {/* Metric 5: Pendentes */}
            <div className="flex flex-col border-l border-white/10 pl-2.5">
              <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider">Pendentes</span>
              <span className="text-xl font-black text-slate-200 mt-0.5">{stats.pendentes}</span>
              <span className="text-[10px] text-slate-400">Sem data</span>
            </div>

            {/* Metric 6: Não se Aplica */}
            <div className="flex flex-col border-l border-white/10 pl-2.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">N/A</span>
              <span className="text-xl font-black text-slate-300 mt-0.5">{stats.naoSeAplica}</span>
              <span className="text-[10px] text-slate-400">Isentos</span>
            </div>
          </div>
        </div>
      </div>

      {/* ──────── Controles de Busca & Filtro ──────── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-3">
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
              <option value="pendentes">Somente Pendentes (Sem Data)</option>
              <option value="expiradas">Somente Expiradas</option>
              <option value="vencendo">Vencendo nos Próximos 30 dias</option>
              <option value="ativas">Somente Vigentes (Ativas)</option>
              <option value="na">Não se Aplica (N/A)</option>
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

      {/* ──────── Tabela Única Consolidada (Ambas as Outorgas) ──────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-500 gap-3">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            <span className="text-xs font-medium">Carregando controle de outorgas...</span>
          </div>
        ) : filteredConsolidatedRows.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Building2 className="w-10 h-10 text-slate-300 stroke-1" />
            <p className="text-sm font-semibold text-slate-600 mt-1">Nenhuma empresa encontrada</p>
            <p className="text-xs text-slate-400">Tente ajustar os termos de busca ou os filtros aplicados.</p>
          </div>
        ) : (
          <div className="max-h-[580px] overflow-y-auto scrollbar-thin">
            <table className="w-full text-left border-collapse table-fixed relative">
              <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200 shadow-xs">
                <tr className="text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none">
                  {/* Header Razão Social (36% de largura) */}
                  <th
                    onClick={() => handleSort('razao_social')}
                    className="py-3.5 px-4 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors group/th w-[36%]"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Razão Social / CNPJ</span>
                      {renderSortIcon('razao_social')}
                    </div>
                  </th>

                  {/* Header Regime (14% de largura) */}
                  <th
                    onClick={() => handleSort('regime')}
                    className="py-3.5 px-4 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors group/th w-[14%]"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Regime</span>
                      {renderSortIcon('regime')}
                    </div>
                  </th>

                  {/* Header Outorga SPED (25% de largura) */}
                  <th className="py-3.5 px-4 bg-indigo-50/60 text-indigo-900 border-l border-indigo-100 w-[25%]">
                    Outorga SPED (Etapa 1)
                  </th>

                  {/* Header Outorga Apuração (25% de largura) */}
                  <th className="py-3.5 px-4 bg-purple-50/60 text-purple-900 border-l border-purple-100 w-[25%]">
                    Outorga Apuração Assistida (Etapa 3)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredConsolidatedRows.map((row) => {
                  const cRegime = row.client.regime || getRegimeFromSegmento(row.client.segmento);
                  const regimeMeta = REGIMES_CONFIG[cRegime];

                  return (
                    <tr key={row.client.id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Razão Social & CNPJ (36%) */}
                      <td className="py-3.5 px-4 w-[36%]">
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5 flex-wrap">
                            <span className="truncate max-w-[340px]" title={row.client.razao_social}>
                              {row.client.razao_social}
                            </span>
                            {row.client.nome_grupo && (
                              <span className="text-[10px] font-normal text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                                {row.client.nome_grupo}
                              </span>
                            )}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono mt-0.5">
                            {formatCNPJ(row.client.cnpj)}
                          </span>
                        </div>
                      </td>

                      {/* Regime (14%) */}
                      <td className="py-3.5 px-4 w-[14%]">
                        <div className="flex flex-col gap-1 pr-2">
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border w-fit shrink-0",
                            regimeMeta?.badgeBg || 'bg-slate-50',
                            regimeMeta?.badgeText || 'text-slate-600',
                            regimeMeta?.badgeBorder || 'border-slate-200'
                          )}>
                            {regimeMeta?.shortLabel || cRegime}
                          </span>
                        </div>
                      </td>

                      {/* Coluna Outorga SPED (25%) */}
                      <td className="py-3.5 px-4 w-[25%] bg-indigo-50/20 border-l border-indigo-100">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {row.sped.situacao === 'ativa' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Ativa
                              </span>
                            ) : row.sped.situacao === 'expirado' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                <XCircle className="w-3 h-3 text-rose-600" /> Expirado
                              </span>
                            ) : row.sped.situacao === 'na' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                                <Slash className="w-3 h-3 text-slate-500" /> Não se aplica
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                <AlertTriangle className="w-3 h-3 text-amber-600" /> Pendente
                              </span>
                            )}

                            {row.sped.dataValidade && row.sped.situacao !== 'na' && (
                              <span className="text-[11px] text-slate-600 font-mono whitespace-nowrap">
                                Val: {new Date(row.sped.dataValidade + 'T00:00:00').toLocaleDateString('pt-BR')}
                              </span>
                            )}
                          </div>

                          <button
                            onClick={() => handleOpenEdit(row.sped)}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 underline cursor-pointer shrink-0"
                          >
                            <Edit3 className="w-3 h-3" /> Editar
                          </button>
                        </div>
                      </td>

                      {/* Coluna Outorga Apuração Assistida (25%) */}
                      <td className="py-3.5 px-4 w-[25%] bg-purple-50/20 border-l border-purple-100">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {row.apuracao.situacao === 'ativa' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Ativa
                              </span>
                            ) : row.apuracao.situacao === 'expirado' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                <XCircle className="w-3 h-3 text-rose-600" /> Expirado
                              </span>
                            ) : row.apuracao.situacao === 'na' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                                <Slash className="w-3 h-3 text-slate-500" /> Não se aplica
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                <AlertTriangle className="w-3 h-3 text-amber-600" /> Pendente
                              </span>
                            )}

                            {row.apuracao.dataValidade && row.apuracao.situacao !== 'na' && (
                              <span className="text-[11px] text-slate-600 font-mono whitespace-nowrap">
                                Val: {new Date(row.apuracao.dataValidade + 'T00:00:00').toLocaleDateString('pt-BR')}
                              </span>
                            )}
                          </div>

                          <button
                            onClick={() => handleOpenEdit(row.apuracao)}
                            className="text-[10px] font-bold text-purple-600 hover:text-purple-800 flex items-center gap-0.5 underline cursor-pointer shrink-0"
                          >
                            <Edit3 className="w-3 h-3" /> Editar
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
          <div className={cn(
            "bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border relative flex flex-col gap-5 border-t-4",
            editingRow.stepKey === '1'
              ? "border-indigo-600 border-x-slate-200 border-b-slate-200"
              : "border-purple-600 border-x-slate-200 border-b-slate-200"
          )}>
            <button
              onClick={() => setEditingRow(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className={cn(
                "flex items-center gap-2 text-xs font-extrabold px-3 py-1 rounded-lg border w-fit shadow-2xs",
                editingRow.stepKey === '1'
                  ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                  : "bg-purple-50 text-purple-800 border-purple-200"
              )}>
                {editingRow.stepKey === '1' ? <FileCheck className="w-4 h-4 text-indigo-600" /> : <ShieldCheck className="w-4 h-4 text-purple-600" />}
                <span>PREENCHENDO: {editingRow.stepKey === '1' ? 'OUTORGA SPED (ETAPA 1)' : `OUTORGA APURAÇÃO ASSISTIDA (ETAPA ${editingRow.stepKey})`}</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-2.5 truncate">
                {editingRow.client.razao_social}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Atualize a data de liberação, validade ou status para sincronizar com a Fase 1 da esteira.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Data Liberação</label>
                <input
                  type="date"
                  value={editLiberacao}
                  onChange={(e) => setEditLiberacao(e.target.value)}
                  className={cn(
                    "w-full h-9 px-3 bg-slate-50 border rounded-xl text-xs text-slate-800 outline-none transition-all",
                    editingRow.stepKey === '1' ? "border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" : "border-slate-200 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                  )}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Validade da Outorga</label>
                <input
                  type="date"
                  value={editValidade}
                  onChange={(e) => setEditValidade(e.target.value)}
                  className={cn(
                    "w-full h-9 px-3 bg-slate-50 border rounded-xl text-xs text-slate-800 outline-none transition-all",
                    editingRow.stepKey === '1' ? "border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" : "border-slate-200 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                  )}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Status da Etapa no Fluxo</label>
                <select
                  value={editStatusEtapa}
                  onChange={(e) => setEditStatusEtapa(e.target.value as EtapaColorStatus)}
                  className={cn(
                    "w-full h-9 px-3 bg-slate-50 border rounded-xl text-xs font-semibold text-slate-800 outline-none cursor-pointer",
                    editingRow.stepKey === '1' ? "border-slate-200 focus:bg-white focus:border-indigo-500" : "border-slate-200 focus:bg-white focus:border-purple-500"
                  )}
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
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-semibold text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50",
                  editingRow.stepKey === '1' ? "bg-indigo-600 hover:bg-indigo-700" : "bg-purple-600 hover:bg-purple-700"
                )}
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
