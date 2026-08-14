import { useEffect, useState } from 'react';
import { 
  Users, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Loader2, 
  Compass, 
  FileCheck, 
  ShieldCheck, 
  Clock, 
  Database,
  ArrowUpRight,
  UserCheck
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ActivityLog, WorkflowPhase, WorkflowAssignment, TeamMember } from '../types';

interface TeamMemberWorkload {
  id: string;
  usuario: string;
  cargo: string;
  totalAtribuicoes: number;
  etapasPrincipais: number;
  etapasBackup: number;
  etapasEmAndamento: number;
}

function AnimatedCounter({ end, duration = 1000 }: { end: number, duration?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    let animationFrame: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      setCount(Math.floor(progress * end));
      
      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(step);
      } else {
        setCount(end);
      }
    };
    
    animationFrame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [end, duration]);

  return <span>{count.toLocaleString('pt-BR')}</span>;
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const currentYear = new Date().getFullYear();

  // KPIs Globais
  const [stats, setStats] = useState({
    totalClients: 0,
    fase1Concluidos: 0,
    fase1EmAndamento: 0,
    fase2ConcluidosAno: 0,
    fase2EmAndamentoAno: 0,
    fase3ConcluidosAno: 0,
    fase3EmAndamentoAno: 0,
    matrixConforme: 0,
    matrixPendente: 0,
    matrixCritico: 0
  });

  const [logs, setLogs] = useState<ActivityLog[]>([]);

  const [segmentStats, setSegmentStats] = useState<{ industria: number; comercio: number; servico: number }>({
    industria: 0,
    comercio: 0,
    servico: 0
  });

  const [userActivityStats, setUserActivityStats] = useState<TeamMemberWorkload[]>([]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // 1. Total Clientes e Segmentos (Origem: Tabela `clients`)
      const { data: clientsData, error: errC } = await supabase
        .from('clients')
        .select('id, razao_social, segmento');
      if (errC) throw errC;

      const totalClientsCount = clientsData?.length || 0;
      const indCount = clientsData?.filter(c => c.segmento === 'industria').length || 0;
      const comCount = clientsData?.filter(c => c.segmento === 'comercio').length || 0;
      const serCount = clientsData?.filter(c => c.segmento === 'servico').length || 0;

      setSegmentStats({
        industria: indCount,
        comercio: comCount,
        servico: serCount
      });

      // 2. Matriz de Documentos Fiscais (Origem: Tabela `fiscal_documents_matrix`)
      const { data: matrixData, error: errM } = await supabase
        .from('fiscal_documents_matrix')
        .select('client_id, ano_base, mes_base, status_geral');
      if (errM) throw errM;

      const conformeCount = matrixData?.filter(m => m.status_geral === 'completo').length || 0;
      const pendentesCount = matrixData?.filter(m => m.status_geral === 'pendente').length || 0;
      const criticosCount = matrixData?.filter(m => m.status_geral === 'atraso').length || 0;

      // 3. Fases e Atribuições (Origem: Tabelas `workflow_phases` e `workflow_assignments`)
      const { data: phasesData } = await supabase
        .from('workflow_phases')
        .select('*')
        .order('ordem');

      const { data: assignmentsData } = await supabase
        .from('workflow_assignments')
        .select('*');

      const defaultAssignMap: Record<string, WorkflowAssignment> = {};
      (assignmentsData || []).forEach((a: WorkflowAssignment) => {
        defaultAssignMap[a.fase_fluxo] = a;
      });

      // 4. Pipelines do Fluxo de Trabalho (Origem: Tabela `workflow_pipelines`)
      const { data: pipelinesData, error: errP } = await supabase
        .from('workflow_pipelines')
        .select('id, client_id, status, fase_grupo, ano_referencia, mes_referencia, etapa_atual, responsaveis_etapas');
      if (errP) throw errP;

      const f1Done = pipelinesData?.filter(p => p.fase_grupo === 'fase_1' && p.status === 'concluido').length || 0;
      const f1InProgress = pipelinesData?.filter(p => p.fase_grupo === 'fase_1' && p.status !== 'concluido').length || 0;

      const f2Done = pipelinesData?.filter(p => p.fase_grupo === 'fase_2' && p.ano_referencia === currentYear && p.status === 'concluido').length || 0;
      const f2InProgress = pipelinesData?.filter(p => p.fase_grupo === 'fase_2' && p.ano_referencia === currentYear && p.status === 'em_andamento').length || 0;

      const f3Done = pipelinesData?.filter(p => p.fase_grupo === 'fase_3' && p.ano_referencia === currentYear && p.status === 'concluido').length || 0;
      const f3InProgress = pipelinesData?.filter(p => p.fase_grupo === 'fase_3' && p.ano_referencia === currentYear && p.status === 'em_andamento').length || 0;

      setStats({
        totalClients: totalClientsCount,
        fase1Concluidos: f1Done,
        fase1EmAndamento: f1InProgress,
        fase2ConcluidosAno: f2Done,
        fase2EmAndamentoAno: f2InProgress,
        fase3ConcluidosAno: f3Done,
        fase3EmAndamentoAno: f3InProgress,
        matrixConforme: conformeCount,
        matrixPendente: pendentesCount,
        matrixCritico: criticosCount
      });

      // 5. Logs de atividades recentes (Origem: Tabela `activity_logs`)
      const { data: logsData, error: errL } = await supabase
        .from('activity_logs')
        .select('*, clients(razao_social)')
        .order('created_at', { ascending: false })
        .limit(10);
      if (errL) throw errL;
      setLogs(logsData || []);

      // 6. Atribuições por Responsável nas Etapas do Fluxo de Trabalho (Distribuição Real por Empresa e Fase)
      const { data: teamMembersData } = await supabase
        .from('team_members')
        .select('*')
        .order('nome');

      const allPhases = (phasesData || []) as WorkflowPhase[];
      const clientsList = clientsData || [];

      const workloadList: TeamMemberWorkload[] = (teamMembersData || []).map((member: TeamMember) => {
        let principaisCount = 0;
        let backupCount = 0;
        let emAndamentoCount = 0;

        // Itera por todas as empresas cadastradas
        clientsList.forEach(client => {
          // Fase 1: Diagnóstico (7 etapas)
          const f1Phases = allPhases.filter(p => p.grupo_fase === 'fase_1');
          const pipeF1 = pipelinesData?.find(p => p.client_id === client.id && p.fase_grupo === 'fase_1');

          f1Phases.forEach(phase => {
            const stepKey = String(phase.ordem);
            const customResp = pipeF1?.responsaveis_etapas?.[stepKey];
            const defAssign = defaultAssignMap[phase.key];

            const principalId = (customResp && customResp.principal_id !== undefined)
              ? customResp.principal_id
              : defAssign?.responsavel_principal_id;

            const backupId = (customResp && customResp.backup_id !== undefined)
              ? customResp.backup_id
              : defAssign?.responsavel_backup_id;

            if (principalId === member.id) {
              principaisCount++;
              if (pipeF1?.etapa_atual === phase.ordem && pipeF1?.status !== 'concluido') {
                emAndamentoCount++;
              }
            }
            if (backupId === member.id) {
              backupCount++;
            }
          });

          // Fase 2: Plano de Ação (12 meses x 2 etapas no ano corrente)
          const f2Phases = allPhases.filter(p => p.grupo_fase === 'fase_2');
          for (let month = 1; month <= 12; month++) {
            const pipeF2 = pipelinesData?.find(
              p => p.client_id === client.id &&
                   p.fase_grupo === 'fase_2' &&
                   p.ano_referencia === currentYear &&
                   p.mes_referencia === month
            );

            f2Phases.forEach(phase => {
              const stepKey = String(phase.ordem);
              const customResp = pipeF2?.responsaveis_etapas?.[stepKey];
              const defAssign = defaultAssignMap[phase.key];

              const principalId = (customResp && customResp.principal_id !== undefined)
                ? customResp.principal_id
                : defAssign?.responsavel_principal_id;

              const backupId = (customResp && customResp.backup_id !== undefined)
                ? customResp.backup_id
                : defAssign?.responsavel_backup_id;

              if (principalId === member.id) {
                principaisCount++;
                if (pipeF2?.etapa_atual === phase.ordem && pipeF2?.status === 'em_andamento') {
                  emAndamentoCount++;
                }
              }
              if (backupId === member.id) {
                backupCount++;
              }
            });
          }

          // Fase 3: Governança (12 meses x 1 etapa no ano corrente)
          const f3Phases = allPhases.filter(p => p.grupo_fase === 'fase_3');
          for (let month = 1; month <= 12; month++) {
            const pipeF3 = pipelinesData?.find(
              p => p.client_id === client.id &&
                   p.fase_grupo === 'fase_3' &&
                   p.ano_referencia === currentYear &&
                   p.mes_referencia === month
            );

            f3Phases.forEach(phase => {
              const stepKey = String(phase.ordem);
              const customResp = pipeF3?.responsaveis_etapas?.[stepKey];
              const defAssign = defaultAssignMap[phase.key];

              const principalId = (customResp && customResp.principal_id !== undefined)
                ? customResp.principal_id
                : defAssign?.responsavel_principal_id;

              const backupId = (customResp && customResp.backup_id !== undefined)
                ? customResp.backup_id
                : defAssign?.responsavel_backup_id;

              if (principalId === member.id) {
                principaisCount++;
                if (pipeF3?.etapa_atual === phase.ordem && pipeF3?.status === 'em_andamento') {
                  emAndamentoCount++;
                }
              }
              if (backupId === member.id) {
                backupCount++;
              }
            });
          }
        });

        return {
          id: member.id,
          usuario: member.nome,
          cargo: member.cargo || 'Consultor',
          totalAtribuicoes: principaisCount + backupCount,
          etapasPrincipais: principaisCount,
          etapasBackup: backupCount,
          etapasEmAndamento: emAndamentoCount
        };
      }).sort((a, b) => b.totalAtribuicoes - a.totalAtribuicoes);

      setUserActivityStats(workloadList);
    } catch (err: unknown) {
      console.error('Erro ao carregar dados do Dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div className="flex flex-col w-full gap-8">
      {/* ──────── Header Superior ──────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard Geral</h1>
          <p className="text-sm text-slate-500 mt-1">
            Consolidado executivo integrado dos módulos <strong>Checklist Fiscal</strong>, <strong>Fluxo de Trabalho</strong> e <strong>Clientes</strong>.
          </p>
        </div>
        <button
          onClick={fetchDashboardData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : 'text-slate-500'}`} />
          Atualizar Dados
        </button>
      </div>

      {/* ──────── Top KPI Cards (Com Indicação de Origem de Dados) ──────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Total de Empresas */}
        <div className="bg-white rounded-2xl p-5 shadow-2xs border border-slate-200 hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total de Empresas</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold text-slate-900">
              <AnimatedCounter end={stats.totalClients} />
            </div>
            <p className="text-xs text-slate-500 mt-1">Empresas ativas cadastradas</p>
          </div>
          <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span className="flex items-center gap-1">
              <Database className="w-3 h-3 text-indigo-500" />
              Tabela: <strong className="text-slate-600 font-semibold">clients</strong>
            </span>
            <Link to="/clientes" className="text-indigo-600 hover:text-indigo-800 font-sans font-semibold flex items-center gap-0.5">
              Ver <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Card 2: Fase 1 - Diagnósticos */}
        <div className="bg-white rounded-2xl p-5 shadow-2xs border border-indigo-100 hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group bg-gradient-to-br from-white to-indigo-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">Fase 1: Diagnóstico</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Compass className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold text-indigo-950 flex items-baseline gap-1.5">
              <AnimatedCounter end={stats.fase1Concluidos} />
              <span className="text-sm font-normal text-slate-500">/ {stats.totalClients} concluídos</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">{stats.fase1EmAndamento} em andamento</p>
          </div>
          <div className="mt-4 pt-2.5 border-t border-indigo-100/60 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span className="flex items-center gap-1">
              <Database className="w-3 h-3 text-indigo-500" />
              workflow_pipelines (fase_1)
            </span>
            <Link to="/fluxo-de-trabalho" className="text-indigo-600 hover:text-indigo-800 font-sans font-semibold flex items-center gap-0.5">
              Ver <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Card 3: Fase 2 - Plano de Ação */}
        <div className="bg-white rounded-2xl p-5 shadow-2xs border border-blue-100 hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group bg-gradient-to-br from-white to-blue-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700">Fase 2: Plano de Ação</span>
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <FileCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold text-blue-950 flex items-baseline gap-1.5">
              <AnimatedCounter end={stats.fase2ConcluidosAno} />
              <span className="text-sm font-normal text-slate-500">meses concluídos</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {stats.fase2EmAndamentoAno} meses em andamento ({currentYear})
            </p>
          </div>
          <div className="mt-4 pt-2.5 border-t border-blue-100/60 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span className="flex items-center gap-1">
              <Database className="w-3 h-3 text-blue-500" />
              workflow_pipelines (fase_2)
            </span>
            <Link to="/fluxo-de-trabalho" className="text-blue-600 hover:text-blue-800 font-sans font-semibold flex items-center gap-0.5">
              Ver <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Card 4: Fase 3 - Governança */}
        <div className="bg-white rounded-2xl p-5 shadow-2xs border border-emerald-100 hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group bg-gradient-to-br from-white to-emerald-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Fase 3: Governança</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold text-emerald-950 flex items-baseline gap-1.5">
              <AnimatedCounter end={stats.fase3ConcluidosAno} />
              <span className="text-sm font-normal text-slate-500">auditorias concluídas</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {stats.fase3EmAndamentoAno} em andamento ({currentYear})
            </p>
          </div>
          <div className="mt-4 pt-2.5 border-t border-emerald-100/60 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span className="flex items-center gap-1">
              <Database className="w-3 h-3 text-emerald-500" />
              workflow_pipelines (fase_3)
            </span>
            <Link to="/fluxo-de-trabalho" className="text-emerald-600 hover:text-emerald-800 font-sans font-semibold flex items-center gap-0.5">
              Ver <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* ──────── Seção de Visão Integrada: 3 Fases do Fluxo de Trabalho & Checklist ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Painel do Fluxo de Trabalho */}
        <div className="bg-white rounded-2xl p-6 shadow-2xs border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Compass className="w-5 h-5 text-indigo-600" />
                  Fluxo de Trabalho — 3 Fases Integradas
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Origem dos Dados: <strong className="text-slate-700 font-semibold">workflow_pipelines</strong>
                </p>
              </div>
              <Link to="/fluxo-de-trabalho" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                Acessar <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="flex flex-col gap-4 mt-2">
              {/* Fase 1 */}
              <div className="p-3.5 rounded-xl border border-indigo-100 bg-indigo-50/30 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-indigo-900">Fase 1 — Diagnóstico (7 Etapas)</span>
                  <span className="font-semibold text-indigo-700">
                    {stats.fase1Concluidos} de {stats.totalClients} empresas concluídas
                  </span>
                </div>
                <div className="w-full bg-indigo-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-full transition-all duration-700" 
                    style={{ width: `${stats.totalClients ? (stats.fase1Concluidos / stats.totalClients) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Fase 2 */}
              <div className="p-3.5 rounded-xl border border-blue-100 bg-blue-50/30 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-blue-900">Fase 2 — Plano de Ação ({currentYear})</span>
                  <span className="font-semibold text-blue-700">
                    {stats.fase2ConcluidosAno} meses concluídos
                  </span>
                </div>
                <div className="w-full bg-blue-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-blue-600 h-full transition-all duration-700" 
                    style={{ width: `${stats.totalClients ? (stats.fase2ConcluidosAno / Math.max(1, stats.totalClients * 12)) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Fase 3 */}
              <div className="p-3.5 rounded-xl border border-emerald-100 bg-emerald-50/30 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-900">Fase 3 — Governança & Auditoria ({currentYear})</span>
                  <span className="font-semibold text-emerald-700">
                    {stats.fase3ConcluidosAno} auditorias concluídas
                  </span>
                </div>
                <div className="w-full bg-emerald-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-600 h-full transition-all duration-700" 
                    style={{ width: `${stats.totalClients ? (stats.fase3ConcluidosAno / Math.max(1, stats.totalClients * 12)) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Painel do Checklist Fiscal */}
        <div className="bg-white rounded-2xl p-6 shadow-2xs border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Checklist Fiscal — Matriz de Documentos
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Origem dos Dados: <strong className="text-slate-700 font-semibold">fiscal_documents_matrix</strong>
                </p>
              </div>
              <Link to="/checklist" className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 flex items-center gap-1">
                Acessar <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-2">
              <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 flex flex-col items-center justify-center text-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mb-1" />
                <span className="text-2xl font-bold text-emerald-900">{stats.matrixConforme}</span>
                <span className="text-[11px] font-semibold text-emerald-700">Conformes</span>
              </div>

              <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 flex flex-col items-center justify-center text-center">
                <Clock className="w-6 h-6 text-amber-600 mb-1" />
                <span className="text-2xl font-bold text-amber-900">{stats.matrixPendente}</span>
                <span className="text-[11px] font-semibold text-amber-700">Pendentes</span>
              </div>

              <div className="p-4 rounded-xl bg-red-50/60 border border-red-200 flex flex-col items-center justify-center text-center">
                <AlertCircle className="w-6 h-6 text-red-600 mb-1" />
                <span className="text-2xl font-bold text-red-900">{stats.matrixCritico}</span>
                <span className="text-[11px] font-semibold text-red-700">Em Atraso</span>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
              <p>
                Documentos monitorados: <strong>EFD ICMS/IPI, EFD PIS/COFINS, SPED ECD, SPED ECF, XML NF-e, XML CT-e, XML NFS-e</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ──────── Main Content Grid (Segmentos, Responsáveis, Atividade Recente) ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Clientes por Segmento Card */}
          <div className="bg-white rounded-2xl shadow-2xs p-5 flex flex-col border border-slate-200 justify-between h-[290px]">
            <div className="flex flex-col mb-2">
              <h3 className="text-base font-bold text-slate-900">Clientes por Segmento</h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">Origem: <strong className="text-slate-700">clients.segmento</strong></p>
            </div>
            <div className="flex-1 flex flex-col justify-around gap-2.5">
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                    Indústria
                  </span>
                  <span className="font-semibold text-slate-900">{segmentStats.industria}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-blue-600 h-full transition-all duration-500" 
                    style={{ width: `${stats.totalClients ? (segmentStats.industria / stats.totalClients) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                    Comércio
                  </span>
                  <span className="font-semibold text-slate-900">{segmentStats.comercio}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-600 h-full transition-all duration-500" 
                    style={{ width: `${stats.totalClients ? (segmentStats.comercio / stats.totalClients) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                    Serviços
                  </span>
                  <span className="font-semibold text-slate-900">{segmentStats.servico}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-purple-600 h-full transition-all duration-500" 
                    style={{ width: `${stats.totalClients ? (segmentStats.servico / stats.totalClients) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Atribuições por Responsável nas Etapas do Fluxo (Com Scroll) */}
          <div className="bg-white rounded-2xl shadow-2xs p-5 flex flex-col border border-slate-200 h-[290px]">
            <div className="flex flex-col mb-2.5 shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">Atribuições por Responsável</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Fluxo de Trabalho
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Origem: <strong className="text-slate-700">workflow_phases + assignments + pipelines</strong>
              </p>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 pr-1.5 space-y-2.5 scrollbar-thin">
              {userActivityStats.length === 0 ? (
                <div className="text-xs text-slate-400 italic text-center py-6">Nenhum responsável cadastrado</div>
              ) : (
                userActivityStats.map((item, idx) => {
                  const maxCount = userActivityStats[0]?.totalAtribuicoes || 1;
                  const colors = ['bg-indigo-600', 'bg-blue-500', 'bg-purple-500', 'bg-emerald-600', 'bg-slate-600'];
                  
                  return (
                    <div key={item.id} className="space-y-1 p-2 rounded-xl bg-slate-50/70 border border-slate-100 hover:bg-slate-100/80 transition-colors">
                      <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 truncate max-w-[140px]" title={item.usuario}>
                            {item.usuario}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">{item.cargo}</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="font-bold text-slate-900 text-xs">
                            {item.totalAtribuicoes} etapa{item.totalAtribuicoes !== 1 ? 's' : ''}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {item.etapasPrincipais} princ. {item.etapasBackup > 0 ? `• ${item.etapasBackup} bkp` : ''}
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`${colors[idx % colors.length]} h-full transition-all duration-500`}
                          style={{ width: maxCount > 0 ? `${(item.totalAtribuicoes / maxCount) * 100}%` : '0%' }}
                        ></div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Recent Activity (Com Scroll e Altura Compacta) */}
        <div className="bg-white rounded-2xl shadow-2xs p-5 flex flex-col h-[290px] border border-slate-200">
          <div className="flex items-center justify-between mb-2.5 shrink-0">
            <div>
              <h2 className="text-base font-bold text-slate-900">Atividade Recente</h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">Origem: <strong className="text-slate-700">activity_logs</strong></p>
            </div>
          </div>
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
              Carregando atividades...
            </div>
          ) : logs.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm text-center">
              Nenhuma atividade registrada na trilha de auditoria.
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto min-h-0 pr-1.5 space-y-3 relative scrollbar-thin">
              <div className="absolute left-[11px] top-3 bottom-3 w-px bg-slate-200"></div>
              {logs.map((log) => (
                <div key={log.id} className="flex gap-3 relative">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 relative z-10 shadow-[0_0_0_4px_#ffffff]">
                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-slate-700 leading-snug">
                      <strong className="text-slate-900">{log.clients?.razao_social || log.titulo}: </strong> 
                      {log.descricao}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 font-mono">
                      <span>{new Date(log.created_at).toLocaleTimeString('pt-BR')}</span>
                      {log.usuario_nome && <span>• {log.usuario_nome}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
