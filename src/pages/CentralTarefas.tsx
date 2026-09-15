import React, { useState, useMemo } from 'react';
import { useCentralTarefas } from '../hooks/useCentralTarefas';
import { CentralTarefa, CentralTarefaStatus, Client, TeamMember } from '../types';
import { supabase } from '../lib/supabase';
import KanbanColumn from '../components/central-tarefas/KanbanColumn';
import GutRankingView from '../components/central-tarefas/GutRankingView';
import NovaTarefaModal from '../components/central-tarefas/NovaTarefaModal';
import {
  KanbanSquare,
  Plus,
  Search,
  Building2,
  User,
  Flame,
  LayoutGrid,
  ListOrdered,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function CentralTarefas() {
  const {
    tarefas,
    loading,
    error,
    fetchTarefas,
    createTarefa,
    updateStatus,
    updateTarefa,
    deleteTarefa
  } = useCentralTarefas();

  // Clientes e membros para os filtros e modal
  const [clients, setClients] = useState<Client[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);

  // Carregar clientes e membros
  React.useEffect(() => {
    async function loadAuxData() {
      try {
        const [{ data: cData }, { data: mData }] = await Promise.all([
          supabase.from('clients').select('*').order('razao_social'),
          supabase.from('team_members').select('*').order('nome')
        ]);
        if (cData) setClients(cData);
        if (mData) setMembers(mData);
      } catch (err) {
        console.error('Erro ao carregar clientes/membros para a Central de Tarefas:', err);
      }
    }
    loadAuxData();
  }, []);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<string>('todos');
  const [selectedMember, setSelectedMember] = useState<string>('todos');
  const [selectedCriticity, setSelectedCriticity] = useState<string>('todos');
  const [viewMode, setViewMode] = useState<'kanban' | 'ranking'>('kanban');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tarefaToEdit, setTarefaToEdit] = useState<CentralTarefa | null>(null);
  const [modalInitialStatus, setModalInitialStatus] = useState<CentralTarefaStatus>('todo');

  // Filtragem das tarefas
  const filteredTarefas = useMemo(() => {
    return tarefas.filter(t => {
      // Busca texto
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchTitle = t.titulo.toLowerCase().includes(term);
        const matchDesc = (t.descricao || '').toLowerCase().includes(term);
        const matchClient = (t.client?.razao_social || '').toLowerCase().includes(term);
        if (!matchTitle && !matchDesc && !matchClient) return false;
      }

      // Filtro Cliente
      if (selectedClient !== 'todos') {
        if (t.client_id !== selectedClient) return false;
      }

      // Filtro Responsável
      if (selectedMember !== 'todos') {
        if (t.responsavel_id !== selectedMember) return false;
      }

      // Filtro Criticidade GUT
      if (selectedCriticity !== 'todos') {
        if (selectedCriticity === 'critica' && t.gut_score < 80) return false;
        if (selectedCriticity === 'alta' && (t.gut_score < 50 || t.gut_score >= 80)) return false;
        if (selectedCriticity === 'media' && (t.gut_score < 25 || t.gut_score >= 50)) return false;
        if (selectedCriticity === 'baixa' && t.gut_score >= 25) return false;
      }

      return true;
    });
  }, [tarefas, searchTerm, selectedClient, selectedMember, selectedCriticity]);

  // Estatísticas do Topo
  const stats = useMemo(() => {
    const total = tarefas.length;
    const criticas = tarefas.filter(t => t.gut_score >= 80 && t.status !== 'done').length;
    const emAndamento = tarefas.filter(t => t.status === 'in_progress').length;
    const aFazer = tarefas.filter(t => t.status === 'todo').length;
    const concluidas = tarefas.filter(t => t.status === 'done').length;

    return { total, criticas, emAndamento, aFazer, concluidas };
  }, [tarefas]);

  const handleOpenCreateModal = (initialColStatus: CentralTarefaStatus = 'todo') => {
    setTarefaToEdit(null);
    setModalInitialStatus(initialColStatus);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (tarefa: CentralTarefa) => {
    setTarefaToEdit(tarefa);
    setIsModalOpen(true);
  };

  const handleSaveModal = async (data: {
    id?: string;
    titulo: string;
    descricao?: string | null;
    client_id?: string | null;
    responsavel_id?: string | null;
    status: CentralTarefaStatus;
    gravidade: number;
    urgencia: number;
    tendencia: number;
    data_vencimento?: string | null;
  }) => {
    if (data.id) {
      await updateTarefa(data.id, data);
    } else {
      await createTarefa(data);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* ──────── Header Superior com Gradiente Moderno (Idêntico ao Cliente Recorrente) ──────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-60 h-60 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Lado Esquerdo: Ícone + Título + Descrição */}
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner shrink-0">
            <KanbanSquare className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 uppercase tracking-wider">
                Matriz GUT & Kanban
              </span>
            </div>
            <h1 className="text-2xl font-black text-white mt-1 tracking-tight">
              Central de Tarefas
            </h1>
            <p className="text-xs text-indigo-100/80 mt-1 max-w-xl">
              Priorização inteligente via <strong>Matriz GUT</strong> (Gravidade × Urgência × Tendência) e gestão visual das demandas.
            </p>
          </div>
        </div>

        {/* Lado Direito: Métricas Rápidas & Controles */}
        <div className="flex flex-col gap-2.5 relative z-10 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10">
            {/* Metric 1: Total */}
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider">Tarefas</span>
              <span className="text-xl font-black text-white mt-0.5">{stats.total}</span>
              <span className="text-[10px] text-slate-400">Total cadastradas</span>
            </div>

            {/* Metric 2: Críticas */}
            <div className="flex flex-col border-l border-white/10 pl-3">
              <span className="text-[10px] uppercase font-bold text-rose-300 tracking-wider flex items-center gap-1">
                <Flame className="w-3 h-3 text-rose-400" />
                GUT Crítico
              </span>
              <span className="text-xl font-black text-rose-200 mt-0.5">{stats.criticas}</span>
              <span className="text-[10px] text-rose-300/80">Score &ge; 80</span>
            </div>

            {/* Metric 3: Em Andamento */}
            <div className="flex flex-col border-l border-white/10 pl-3">
              <span className="text-[10px] uppercase font-bold text-amber-300 tracking-wider">Em Andamento</span>
              <span className="text-xl font-black text-amber-200 mt-0.5">{stats.emAndamento}</span>
              <span className="text-[10px] text-amber-300/80">{stats.aFazer} a fazer</span>
            </div>

            {/* Metric 4: Concluídas */}
            <div className="flex flex-col border-l border-white/10 pl-3">
              <span className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider">Concluídas</span>
              <span className="text-xl font-black text-emerald-300 mt-0.5">{stats.concluidas}</span>
              <span className="text-[10px] text-emerald-300/80">Finalizadas</span>
            </div>
          </div>

          {/* Botões de Ação no Header */}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => handleOpenCreateModal('todo')}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/30 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-98"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Tarefa</span>
            </button>

            <button
              type="button"
              onClick={() => fetchTarefas()}
              className="p-1.5 bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-xl text-xs font-semibold backdrop-blur-md transition-colors cursor-pointer"
              title="Recarregar dados"
            >
              <RefreshCw className="w-3.5 h-3.5 text-indigo-200" />
            </button>
          </div>
        </div>
      </div>

      {/* ──────── Barra de Filtros & Alternador de Visão ──────── */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
        {/* Busca por texto */}
        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por título, descrição ou empresa..."
            className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
          />
        </div>

        {/* Filtros Dropdown */}
        <div className="flex items-center gap-2.5 w-full lg:w-auto justify-end flex-wrap">
          {/* Filtro Empresa */}
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="h-9 px-2.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer max-w-[170px] truncate"
            >
              <option value="todos">Todas as Empresas</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.razao_social}</option>
              ))}
            </select>
          </div>

          {/* Filtro Responsável */}
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedMember}
              onChange={(e) => setSelectedMember(e.target.value)}
              className="h-9 px-2.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer max-w-[150px] truncate"
            >
              <option value="todos">Todos os Responsáveis</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
          </div>

          {/* Filtro Criticidade GUT */}
          <div className="flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <select
              value={selectedCriticity}
              onChange={(e) => setSelectedCriticity(e.target.value)}
              className="h-9 px-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer"
            >
              <option value="todos">Todas as Prioridades</option>
              <option value="critica">🔴 Crítico (Score &ge; 80)</option>
              <option value="alta">🟠 Alta (Score 50-79)</option>
              <option value="media">🔵 Média (Score 25-49)</option>
              <option value="baixa">🟢 Baixa (Score &lt; 25)</option>
            </select>
          </div>

          {/* Alternador de Visão (Kanban vs Ranking) */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 ml-1">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                viewMode === 'kanban'
                  ? "bg-white text-indigo-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
              title="Visão Kanban Board"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kanban</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('ranking')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                viewMode === 'ranking'
                  ? "bg-white text-indigo-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
              title="Visão Ranking GUT"
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ranking GUT</span>
            </button>
          </div>
        </div>
      </div>

      {/* ──────── Conteúdo Principal ──────── */}
      {loading ? (
        <div className="flex items-center justify-center p-16 text-slate-500 gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <span className="text-sm font-medium">Carregando tarefas da central...</span>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
          <span>Erro ao carregar tarefas: {error}</span>
        </div>
      ) : viewMode === 'kanban' ? (
        /* Visão Quadro Kanban (4 colunas) */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
          <KanbanColumn
            status="backlog"
            title="Backlog"
            tarefas={filteredTarefas.filter(t => t.status === 'backlog')}
            onMoveStatus={updateStatus}
            onEdit={handleOpenEditModal}
            onDelete={deleteTarefa}
            onAddNew={() => handleOpenCreateModal('backlog')}
          />

          <KanbanColumn
            status="todo"
            title="A Fazer"
            tarefas={filteredTarefas.filter(t => t.status === 'todo')}
            onMoveStatus={updateStatus}
            onEdit={handleOpenEditModal}
            onDelete={deleteTarefa}
            onAddNew={() => handleOpenCreateModal('todo')}
          />

          <KanbanColumn
            status="in_progress"
            title="Em Andamento"
            tarefas={filteredTarefas.filter(t => t.status === 'in_progress')}
            onMoveStatus={updateStatus}
            onEdit={handleOpenEditModal}
            onDelete={deleteTarefa}
            onAddNew={() => handleOpenCreateModal('in_progress')}
          />

          <KanbanColumn
            status="done"
            title="Concluído"
            tarefas={filteredTarefas.filter(t => t.status === 'done')}
            onMoveStatus={updateStatus}
            onEdit={handleOpenEditModal}
            onDelete={deleteTarefa}
            onAddNew={() => handleOpenCreateModal('done')}
          />
        </div>
      ) : (
        /* Visão Tabela / Ranking GUT */
        <GutRankingView
          tarefas={filteredTarefas}
          onEdit={handleOpenEditModal}
          onDelete={deleteTarefa}
          onMoveStatus={updateStatus}
        />
      )}

      {/* Modal de Criação / Edição */}
      <NovaTarefaModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveModal}
        tarefaToEdit={tarefaToEdit}
        initialStatus={modalInitialStatus}
        clients={clients}
        members={members}
      />
    </div>
  );
}
