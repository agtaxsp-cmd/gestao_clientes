import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Bell, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  RefreshCw, 
  LogOut, 
  CheckCheck, 
  X, 
  User, 
  Compass, 
  FileCheck, 
  ShieldCheck, 
  ArrowUpRight, 
  Clock, 
  Calendar,
  CheckCircle,
  Briefcase
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ActivityLog, WorkflowPipeline, WorkflowPhase, WorkflowAssignment, TeamMember, Client, FaseGrupoEnum, getRegimeFromSegmento } from '../types';
import { cn } from '../lib/utils';
import { MESES } from './workflow/types';

function formatRelativeTime(dateStr?: string | null) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'Agora mesmo';
  if (diffMinutes < 60) return `há ${diffMinutes} min`;
  if (diffHours < 24) return `há ${diffHours} h`;
  if (diffDays < 7) return `há ${diffDays} d`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

interface AssignedTask {
  id: string;
  pipelineId?: string;
  clientId: string;
  clientName: string;
  clientSegment?: string;
  faseGrupo: 'fase_1' | 'fase_2' | 'fase_3';
  faseNome: string;
  etapaNum: number;
  etapaNome: string;
  status: 'iniciado' | 'em_andamento' | 'concluido';
  mesReferencia?: number | null;
  anoReferencia?: number | null;
  isCurrentStep: boolean;
  isBackup?: boolean;
  assignmentRole: 'principal' | 'backup' | 'multiplo';
}

interface HeaderProps {
  collapsed?: boolean;
}

type TeamMemberWithAuth = TeamMember & {
  email?: string | null;
  user_id?: string | null;
  auth_user_id?: string | null;
  supabase_user_id?: string | null;
  usuario_id?: string | null;
};

function normalizeText(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export default function Header({ collapsed = false }: HeaderProps) {
  const { user, loading: authLoading, signOut, getUserName } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<ActivityLog[]>([]);
  const [assignedTasks, setAssignedTasks] = useState<AssignedTask[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [taskFilter, setTaskFilter] = useState<'todas' | 'em_andamento' | 'planejadas' | 'concluidas'>('todas');
  const [activeTabMobile, setActiveTabMobile] = useState<'atribuidas' | 'notificacoes'>('atribuidas');
  const panelRef = useRef<HTMLDivElement>(null);

  const currentUserName = getUserName() || 'Administrador';
  const currentYear = new Date().getFullYear();

  const fetchHeaderData = async () => {
    try {
      setLoading(true);

      // 1. Logs de atividades recentes
      const { data: logsData, error: errLogs } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(25);
      if (errLogs) throw errLogs;
      setNotifications(logsData || []);

      // 2. Dados para mapear tarefas do usuário logado
      const [
        { data: membersData },
        { data: phasesData },
        { data: assignmentsData },
        { data: pipelinesData },
        { data: clientsData }
      ] = await Promise.all([
        supabase.from('team_members').select('*'),
        supabase.from('workflow_phases').select('*').order('ordem'),
        supabase.from('workflow_assignments').select('*'),
        supabase.from('workflow_pipelines').select('*'),
        supabase.from('clients').select('id, razao_social, segmento')
      ]);

      const members = (membersData || []) as TeamMember[];
      const phases = (phasesData || []) as WorkflowPhase[];
      const assignments = (assignmentsData || []) as WorkflowAssignment[];
      const pipelines = (pipelinesData || []) as WorkflowPipeline[];
      const clients = (clientsData || []) as Client[];

      // Encontra o membro correspondente ao usuário logado
      const authUserId = user?.id || '';
      const userEmail = normalizeText(user?.email);
      const authNames = [
        currentUserName,
        user?.user_metadata?.full_name,
        user?.user_metadata?.name,
        user?.email?.split('@')[0]
      ]
        .map(value => normalizeText(value as string | undefined))
        .filter(Boolean);

      const matchedMember = (members as TeamMemberWithAuth[]).find(m => {
        const memberAuthIds = [
          m.user_id,
          m.auth_user_id,
          m.supabase_user_id,
          m.usuario_id
        ].filter(Boolean);

        if (authUserId && memberAuthIds.includes(authUserId)) return true;
        if (userEmail && normalizeText(m.email) === userEmail) return true;

        const memberName = normalizeText(m.nome);
        return Boolean(memberName) && authNames.some(name => (
          memberName === name ||
          (name.length >= 3 && memberName.includes(name)) ||
          (memberName.length >= 3 && name.includes(memberName))
        ));
      });

      if (!matchedMember) {
        setAssignedTasks([]);
        return;
      }

      const defaultAssignMap: Record<string, WorkflowAssignment> = {};
      assignments.forEach(a => {
        defaultAssignMap[a.fase_fluxo] = a;
      });

      const tasks: AssignedTask[] = [];

      const getClientPhasesForGroup = (client: Client, grupo: FaseGrupoEnum) => {
        const clientRegime = client.regime || getRegimeFromSegmento(client.segmento);
        return phases
          .filter(p => p.grupo_fase === grupo)
          .filter(p => !p.regime || p.regime === 'geral' || p.regime === clientRegime)
          .sort((a, b) => a.ordem - b.ordem);
      };

      const getStepAssignment = (
        pipe: WorkflowPipeline | undefined,
        phase: WorkflowPhase,
        stepNum: number
      ): { isAssigned: boolean; role: AssignedTask['assignmentRole'] } => {
        const stepKey = String(stepNum);
        const customMultipleIds = pipe?.responsaveis_multiplos_etapas?.[stepKey] || [];

        if (customMultipleIds.length > 0) {
          return {
            isAssigned: customMultipleIds.includes(matchedMember.id),
            role: 'multiplo'
          };
        }

        const customResp = pipe?.responsaveis_etapas?.[stepKey];
        const defAssign = defaultAssignMap[phase.key];

        const principalId = customResp?.principal_id !== undefined
          ? customResp.principal_id
          : defAssign?.responsavel_principal_id;

        const backupId = customResp?.backup_id !== undefined
          ? customResp.backup_id
          : defAssign?.responsavel_backup_id;

        if (principalId === matchedMember.id) {
          return { isAssigned: true, role: 'principal' };
        }

        if (backupId === matchedMember.id) {
          return { isAssigned: true, role: 'backup' };
        }

        return { isAssigned: false, role: 'principal' };
      };

      clients.forEach(client => {
        // --- Fase 1: Diagnóstico (7 Etapas) ---
        const f1Phases = getClientPhasesForGroup(client, 'fase_1');
        const pipeF1 = pipelines.find(p => p.client_id === client.id && p.fase_grupo === 'fase_1');
        const f1StepNum = pipeF1?.etapa_atual || 1;
        const isF1Done = pipeF1?.status === 'concluido';

        f1Phases.forEach((phase, index) => {
          const stepNum = index + 1;
          const assignment = getStepAssignment(pipeF1, phase, stepNum);

          if (assignment.isAssigned) {
            let stepStatus: 'iniciado' | 'em_andamento' | 'concluido' = 'iniciado';
            let isCurrent = false;

            if (isF1Done || stepNum < f1StepNum) {
              stepStatus = 'concluido';
            } else if (stepNum === f1StepNum && !isF1Done) {
              stepStatus = 'em_andamento';
              isCurrent = true;
            }

            tasks.push({
              id: `f1-${client.id}-${phase.ordem}`,
              pipelineId: pipeF1?.id,
              clientId: client.id,
              clientName: client.razao_social,
              clientSegment: client.segmento,
              faseGrupo: 'fase_1',
              faseNome: 'Fase 1 — Diagnóstico',
              etapaNum: stepNum,
              etapaNome: phase.nome,
              status: stepStatus,
              isCurrentStep: isCurrent,
              isBackup: assignment.role === 'backup',
              assignmentRole: assignment.role
            });
          }
        });

        // --- Fase 2: Plano de Ação (12 Meses x 2 Etapas) ---
        const f2Phases = getClientPhasesForGroup(client, 'fase_2');
        for (let month = 1; month <= 12; month++) {
          const pipeF2 = pipelines.find(
            p => p.client_id === client.id &&
                 p.fase_grupo === 'fase_2' &&
                 p.ano_referencia === currentYear &&
                 p.mes_referencia === month
          );
          const f2StepNum = pipeF2?.etapa_atual || 1;
          const isF2Done = pipeF2?.status === 'concluido';
          const isF2InProgress = pipeF2?.status === 'em_andamento';

          f2Phases.forEach((phase, index) => {
            const stepNum = index + 1;
            const assignment = getStepAssignment(pipeF2, phase, stepNum);

            if (assignment.isAssigned) {
              let stepStatus: 'iniciado' | 'em_andamento' | 'concluido' = 'iniciado';
              let isCurrent = false;

              if (isF2Done || (isF2InProgress && stepNum < f2StepNum)) {
                stepStatus = 'concluido';
              } else if (isF2InProgress && stepNum === f2StepNum) {
                stepStatus = 'em_andamento';
                isCurrent = true;
              }

              tasks.push({
                id: `f2-${client.id}-${month}-${phase.ordem}`,
                pipelineId: pipeF2?.id,
                clientId: client.id,
                clientName: client.razao_social,
                clientSegment: client.segmento,
                faseGrupo: 'fase_2',
                faseNome: 'Fase 2 — Plano de Ação',
                etapaNum: stepNum,
                etapaNome: phase.nome,
                mesReferencia: month,
                anoReferencia: currentYear,
                status: stepStatus,
                isCurrentStep: isCurrent,
                isBackup: assignment.role === 'backup',
                assignmentRole: assignment.role
              });
            }
          });
        }

        // --- Fase 3: Governança (12 Meses x 1 Etapa) ---
        const f3Phases = getClientPhasesForGroup(client, 'fase_3');
        for (let month = 1; month <= 12; month++) {
          const pipeF3 = pipelines.find(
            p => p.client_id === client.id &&
                 p.fase_grupo === 'fase_3' &&
                 p.ano_referencia === currentYear &&
                 p.mes_referencia === month
          );
          const isF3Done = pipeF3?.status === 'concluido';
          const isF3InProgress = pipeF3?.status === 'em_andamento';

          f3Phases.forEach((phase, index) => {
            const stepNum = index + 1;
            const assignment = getStepAssignment(pipeF3, phase, stepNum);

            if (assignment.isAssigned) {
              let stepStatus: 'iniciado' | 'em_andamento' | 'concluido' = 'iniciado';
              let isCurrent = false;

              if (isF3Done) {
                stepStatus = 'concluido';
              } else if (isF3InProgress) {
                stepStatus = 'em_andamento';
                isCurrent = true;
              }

              tasks.push({
                id: `f3-${client.id}-${month}-${phase.ordem}`,
                pipelineId: pipeF3?.id,
                clientId: client.id,
                clientName: client.razao_social,
                clientSegment: client.segmento,
                faseGrupo: 'fase_3',
                faseNome: 'Fase 3 — Governança',
                etapaNum: stepNum,
                etapaNome: phase.nome,
                mesReferencia: month,
                anoReferencia: currentYear,
                status: stepStatus,
                isCurrentStep: isCurrent,
                isBackup: assignment.role === 'backup',
                assignmentRole: assignment.role
              });
            }
          });
        }
      });

      // Ordenar: tarefas ativas no momento primeiro, depois iniciadas, depois concluídas
      tasks.sort((a, b) => {
        if (a.isCurrentStep && !b.isCurrentStep) return -1;
        if (!a.isCurrentStep && b.isCurrentStep) return 1;
        if (a.status === 'em_andamento' && b.status !== 'em_andamento') return -1;
        if (a.status !== 'em_andamento' && b.status === 'em_andamento') return 1;
        if (a.status === 'iniciado' && b.status === 'concluido') return -1;
        if (a.status === 'concluido' && b.status === 'iniciado') return 1;
        return (a.clientName || '').localeCompare(b.clientName || '');
      });

      setAssignedTasks(tasks);
    } catch (err) {
      console.error('Erro ao carregar dados do cabeçalho:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHeaderData();

    // Inscrever para atualizações em tempo real das notificações e pipelines
    const channelLogs = supabase
      .channel('header_logs_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, (payload) => {
        setNotifications((prev) => [payload.new as ActivityLog, ...prev.slice(0, 24)]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workflow_pipelines' }, () => {
        fetchHeaderData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channelLogs);
    };
  }, [currentUserName, user?.id, user?.email]);

  // Fechar o painel se clicar fora dele
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.lido).length;
  const activeTasksCount = assignedTasks.filter((t) => t.isCurrentStep || t.status === 'em_andamento').length;
  const plannedTasksCount = assignedTasks.filter((t) => t.status === 'iniciado' && !t.isCurrentStep).length;
  const doneTasksCount = assignedTasks.filter((t) => t.status === 'concluido').length;

  const filteredTasks = useMemo(() => {
    if (taskFilter === 'em_andamento') {
      return assignedTasks.filter(t => t.isCurrentStep || t.status === 'em_andamento');
    }
    if (taskFilter === 'planejadas') {
      return assignedTasks.filter(t => t.status === 'iniciado' && !t.isCurrentStep);
    }
    if (taskFilter === 'concluidas') {
      return assignedTasks.filter(t => t.status === 'concluido');
    }
    return assignedTasks;
  }, [assignedTasks, taskFilter]);

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications.filter((n) => !n.lido).map((n) => n.id);
      if (unreadIds.length === 0) return;

      const { error } = await supabase
        .from('activity_logs')
        .update({ lido: true })
        .in('id', unreadIds);

      if (error) throw error;

      setNotifications((prev) => prev.map((n) => ({ ...n, lido: true })));
    } catch (err) {
      console.error('Erro ao marcar notificações como lidas:', err);
    }
  };

  const getLogIcon = (tipo: string) => {
    switch (tipo) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />;
      case 'sync':
        return <RefreshCw className="w-4 h-4 text-amber-600 shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-indigo-600 shrink-0" />;
    }
  };

  const getPhaseBadge = (grupo: 'fase_1' | 'fase_2' | 'fase_3', mes?: number | null) => {
    if (grupo === 'fase_1') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <Compass className="w-3 h-3" /> F1 Diagnóstico
        </span>
      );
    }
    if (grupo === 'fase_2') {
      const mesObj = (mes && mes >= 1 && mes <= 12) ? MESES[mes - 1] : null;
      const mesNome = mesObj ? mesObj.sigla : `Mês ${mes || ''}`;
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
          <FileCheck className="w-3 h-3" /> F2 {mesNome}
        </span>
      );
    }
    const mesObj3 = (mes && mes >= 1 && mes <= 12) ? MESES[mes - 1] : null;
    const mesNome = mesObj3 ? mesObj3.sigla : `Mês ${mes || ''}`;
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <ShieldCheck className="w-3 h-3" /> F3 {mesNome}
      </span>
    );
  };

  return (
    <header className={cn(
      "fixed top-0 right-0 h-16 bg-white/80 backdrop-blur-md z-40 px-8 flex items-center justify-between border-b border-slate-200/50 transition-all duration-300",
      collapsed ? "left-16" : "left-60"
    )}>
      {/* Área esquerda do Header */}
      <div className="flex items-center gap-2">
        {/* Espaço limpo e responsivo */}
      </div>

      <div className="flex items-center gap-4 relative" ref={panelRef}>
        {/* Perfil do Usuário Logado & Botão Sair */}
        {authLoading ? (
          <span className="text-xs text-slate-400">Carregando...</span>
        ) : (
          <div className="flex items-center gap-2.5 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200 shadow-2xs">
            <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs uppercase">
              {currentUserName[0] || 'U'}
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-800 leading-tight truncate max-w-[140px]" title={currentUserName}>
                {currentUserName}
              </span>
              <span className="text-[10px] text-emerald-600 font-semibold leading-tight">Autenticado</span>
            </div>
            <button
              onClick={async () => {
                await signOut();
                navigate('/login');
              }}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors cursor-pointer ml-1"
              title="Sair da Conta (Logout)"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Botão do Sininho / Notificações */}
        <button
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) fetchHeaderData();
          }}
          className={cn(
            "relative p-2 text-slate-500 hover:text-indigo-600 transition-all cursor-pointer rounded-full hover:bg-slate-100",
            isOpen && "bg-indigo-50 text-indigo-600 ring-2 ring-indigo-200"
          )}
          title="Central Profissional de Tarefas & Notificações"
        >
          <Bell className="w-5 h-5" />
          {(unreadCount > 0 || activeTasksCount > 0) && (
            <span className="absolute top-1 right-1 flex items-center justify-center min-w-4 h-4 px-1 bg-indigo-600 text-white text-[10px] font-bold rounded-full border-2 border-white animate-pulse shadow-xs">
              {(unreadCount + activeTasksCount) > 9 ? '9+' : (unreadCount + activeTasksCount)}
            </span>
          )}
        </button>

        {/* Painel Central Duplo Profissional (Atribuídas a Mim + Notificações e Movimentações) */}
        {isOpen && (
          <div className="absolute top-12 right-0 w-[92vw] sm:w-[700px] lg:w-[860px] max-w-[900px] bg-white rounded-3xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Topo do Modal com Header e Ações */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-600/30 border border-indigo-400/40 text-indigo-300 flex items-center justify-center">
                  <Briefcase className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">Central de Produtividade & Notificações</h3>
                  <p className="text-[11px] text-slate-400">
                    Visão unificada de responsabilidades de <strong className="text-indigo-300">{currentUserName}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchHeaderData}
                  disabled={loading}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Atualizar agora"
                >
                  <RefreshCw className={cn("w-4 h-4", loading && "animate-spin text-indigo-400")} />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Alternador de Abas Mobile */}
            <div className="flex lg:hidden border-b border-slate-200 bg-slate-50 p-1.5">
              <button
                onClick={() => setActiveTabMobile('atribuidas')}
                className={cn(
                  "flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                  activeTabMobile === 'atribuidas'
                    ? "bg-white text-indigo-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Briefcase className="w-3.5 h-3.5" />
                Atribuídas a Mim ({assignedTasks.length})
              </button>
              <button
                onClick={() => setActiveTabMobile('notificacoes')}
                className={cn(
                  "flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                  activeTabMobile === 'notificacoes'
                    ? "bg-white text-indigo-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Bell className="w-3.5 h-3.5" />
                Notificações ({unreadCount})
              </button>
            </div>

            {/* Corpo com Grid Duplo (Lado Esquerdo: Atribuídas a Mim / Lado Direito: Notificações) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 h-[480px]">
              {/* ──────── LADO ESQUERDO: Atribuídas a Mim ──────── */}
              <div className={cn(
                "flex flex-col h-full min-h-0 bg-slate-50/40",
                activeTabMobile !== 'atribuidas' && "hidden lg:flex"
              )}>
                {/* Header da Coluna */}
                <div className="p-4 border-b border-slate-200 bg-white flex flex-col gap-2.5 shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Atribuídas a Mim
                      </h4>
                    </div>
                    <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                      {assignedTasks.filter(t => t.status === 'concluido').length}/{assignedTasks.length} concluídas
                    </span>
                  </div>

                  {/* Filtros rápidos de status */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => setTaskFilter('em_andamento')}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer",
                        taskFilter === 'em_andamento'
                          ? "bg-indigo-600 text-white shadow-2xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      )}
                    >
                      Aguardando Ação ({activeTasksCount})
                    </button>
                    <button
                      onClick={() => setTaskFilter('planejadas')}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer",
                        taskFilter === 'planejadas'
                          ? "bg-indigo-600 text-white shadow-2xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      )}
                    >
                      Futuras ({plannedTasksCount})
                    </button>
                    <button
                      onClick={() => setTaskFilter('concluidas')}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer",
                        taskFilter === 'concluidas'
                          ? "bg-indigo-600 text-white shadow-2xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      )}
                    >
                      Concluídas ({doneTasksCount})
                    </button>
                    <button
                      onClick={() => setTaskFilter('todas')}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer",
                        taskFilter === 'todas'
                          ? "bg-indigo-600 text-white shadow-2xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      )}
                    >
                      Todas ({assignedTasks.length})
                    </button>
                  </div>
                </div>

                {/* Lista de Tarefas */}
                <div className="flex-1 overflow-y-auto min-h-0 max-h-[390px] p-3 space-y-2.5 scrollbar-thin">
                  {filteredTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center h-full p-6 text-slate-400">
                      <CheckCircle className="w-8 h-8 text-emerald-500 mb-2 opacity-80" />
                      <p className="text-xs font-semibold text-slate-700">Tudo em dia!</p>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-[220px]">
                        {taskFilter === 'em_andamento'
                          ? 'Nenhuma tarefa pendente de execução imediata sob sua responsabilidade.'
                          : taskFilter === 'planejadas'
                            ? 'Nenhuma tarefa futura agendada ou aguardando etapas anteriores.'
                            : 'Nenhuma atribuição encontrada neste filtro.'}
                      </p>
                    </div>
                  ) : (
                    filteredTasks.map((task) => {
                      const isDone = task.status === 'concluido';
                      const isCurrent = task.isCurrentStep;

                      return (
                        <div
                          key={task.id}
                          className={cn(
                            "p-3 rounded-2xl border transition-all duration-200 flex flex-col gap-2 relative bg-white group hover:shadow-sm",
                            isCurrent && "border-indigo-300 ring-1 ring-indigo-100 bg-gradient-to-br from-white to-indigo-50/20",
                            isDone && "border-slate-200/80 opacity-75 hover:opacity-100",
                            !isCurrent && !isDone && "border-slate-200"
                          )}
                        >
                          {/* Cabeçalho da Tarefa: Empresa + Fase */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-xs text-slate-900 truncate" title={task.clientName}>
                              {task.clientName}
                            </span>
                            {getPhaseBadge(task.faseGrupo, task.mesReferencia)}
                          </div>

                          {/* Nome da Etapa & Status */}
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                                {task.etapaNum}
                              </span>
                              <span className="truncate">{task.etapaNome}</span>
                            </div>

                            {isDone ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                                <CheckCircle2 className="w-3 h-3" /> Concluída
                              </span>
                            ) : isCurrent ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200 shrink-0 animate-pulse">
                                <Clock className="w-3 h-3" /> Sua Vez
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                                Planejada
                              </span>
                            )}
                          </div>

                          {/* Rodapé da Tarefa: Atalho para abrir no Fluxo */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                            <span className="text-slate-400 text-[10px]">
                              {task.assignmentRole === 'multiplo'
                                ? 'Responsável indicado'
                                : task.isBackup
                                  ? 'Atribuído como Backup'
                                  : 'Responsável Principal'}
                            </span>
                            <button
                              onClick={() => {
                                setIsOpen(false);
                                navigate('/fluxo-de-trabalho', {
                                  state: {
                                    clientId: task.clientId,
                                    grupo: task.faseGrupo,
                                    stepNum: task.etapaNum,
                                    month: task.mesReferencia
                                  }
                                });
                              }}
                              className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-0.5 cursor-pointer group-hover:underline text-[11px]"
                            >
                              Acessar Etapa <ArrowUpRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* ──────── LADO DIREITO: Notificações e Movimentações ──────── */}
              <div className={cn(
                "flex flex-col h-full min-h-0 bg-white",
                activeTabMobile !== 'notificacoes' && "hidden lg:flex"
              )}>
                {/* Header da Coluna */}
                <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Notificações e Movimentações
                    </h4>
                    {unreadCount > 0 && (
                      <span className="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
                        {unreadCount} novas
                      </span>
                    )}
                  </div>

                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                      title="Marcar todas como lidas"
                    >
                      <CheckCheck className="w-3.5 h-3.5" /> Marcar lidas
                    </button>
                  )}
                </div>

                {/* Lista de Notificações */}
                <div className="flex-1 overflow-y-auto min-h-0 max-h-[390px] divide-y divide-slate-100 scrollbar-thin">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      Nenhuma atividade registrada na trilha de auditoria.
                    </div>
                  ) : (
                    notifications.map((item) => (
                      <div
                        key={item.id}
                        className={cn(
                          "p-3.5 flex items-start gap-3 hover:bg-slate-50 transition-colors relative",
                          !item.lido && "bg-indigo-50/30"
                        )}
                      >
                        <div className="mt-0.5">{getLogIcon(item.tipo_log)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-xs font-semibold text-slate-900 truncate">{item.titulo}</h4>
                            <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                              {formatRelativeTime(item.created_at)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed break-words">
                            {item.descricao}
                          </p>
                          <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100">
                            <span className="text-[10px] font-medium text-slate-500 flex items-center gap-1">
                              <User className="w-3 h-3 text-indigo-500" />
                              {item.usuario_nome || 'Administrador'}
                            </span>
                            {!item.lido && (
                              <span className="w-2 h-2 rounded-full bg-indigo-600" title="Não lida" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Rodapé Executivo */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 px-6">
              <span className="flex items-center gap-1 font-mono text-[11px]">
                <Calendar className="w-3 h-3 text-indigo-600" />
                Ano Base: <strong>{currentYear}</strong>
              </span>
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/fluxo-de-trabalho');
                }}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
              >
                Abrir Módulo Fluxo de Trabalho Completo <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
