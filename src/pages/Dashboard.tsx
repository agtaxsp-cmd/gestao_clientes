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
  UserCheck,
  Search,
  FlaskConical,
  LayoutDashboard
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ActivityLog, WorkflowPhase, WorkflowAssignment, TeamMember, getRegimeFromSegmento } from '../types';

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
  // KPIs Globais
  const [stats, setStats] = useState({
    totalClients: 0,
    totalRaizCnpj: 0,
    fase1Concluidos: 0,
    fase1EmAndamento: 0,
    fase2ConcluidosAno: 0,
    fase2EmAndamentoAno: 0,
    fase3ConcluidosAno: 0,
    fase3EmAndamentoAno: 0,
    matrixConforme: 0,
    matrixPendente: 0,
    matrixCritico: 0,
    totalPocs: 0,
    pocsEmAndamento: 0,
    pocsConvertidas: 0,
    taxaConversaoPoc: 0
  });

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [projectsTimeline, setProjectsTimeline] = useState<{ id: string; nomeGrupo: string; razaoSocial: string; raizCnpj: string; qtdFiliais: number; inicio?: string; fim?: string; status: string; greenSteps?: number; maxSteps?: number; pctProgress?: number }[]>([]);
  const [timelineSearch, setTimelineSearch] = useState<string>('');

  const [segmentStats, setSegmentStats] = useState<{ industria: number; comercio: number; servico: number }>({
    industria: 0,
    comercio: 0,
    servico: 0
  });

  const [userActivityStats, setUserActivityStats] = useState<TeamMemberWorkload[]>([]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // 1. Total Clientes, Raiz CNPJ (Item 10) e Regimes (Origem: Tabela `clients`)
      const { data: clientsData, error: errC } = await supabase
        .from('clients')
        .select('id, cnpj, razao_social, nome_grupo, segmento, regime, tipo_contrato, status_poc');
      if (errC) throw errC;

      const totalClientsCount = clientsData?.length || 0;
      
      // Calcular estatísticas da POC
      const totalPocsCount = clientsData?.filter(c => c.tipo_contrato === 'poc').length || 0;
      const pocsEmAndamentoCount = clientsData?.filter(c => c.tipo_contrato === 'poc' && (!c.status_poc || c.status_poc === 'em_andamento')).length || 0;
      const pocsConvertidasCount = clientsData?.filter(c => c.tipo_contrato === 'poc' && c.status_poc === 'convertido').length || 0;
      const taxaConversaoPoc = totalPocsCount > 0 ? Math.round((pocsConvertidasCount / totalPocsCount) * 100) : 0;

      // Calcular Raiz de CNPJ (8 primeiros dígitos numéricos)
      const raizesUnicas = new Set((clientsData || []).map(c => {
        const clean = c.cnpj.replace(/\D/g, '');
        return clean.slice(0, 8);
      }));
      const totalRaizCount = raizesUnicas.size;

      const regCount = clientsData?.filter(c => (c.regime || getRegimeFromSegmento(c.segmento)) === 'regular').length || 0;
      const espCount = clientsData?.filter(c => (c.regime || getRegimeFromSegmento(c.segmento)) === 'especifico').length || 0;
      const difCount = clientsData?.filter(c => (c.regime || getRegimeFromSegmento(c.segmento)) === 'diferenciado').length || 0;

      setSegmentStats({
        industria: regCount,
        comercio: espCount,
        servico: difCount
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
        .select('*');
      if (errP) throw errP;

      const f1Done = pipelinesData?.filter(p => p.fase_grupo === 'fase_1' && p.status === 'concluido').length || 0;
      const f1InProgress = pipelinesData?.filter(p => p.fase_grupo === 'fase_1' && p.status !== 'concluido').length || 0;

      const f2Done = pipelinesData?.filter(p => p.fase_grupo === 'fase_2' && p.ano_referencia === currentYear && p.status === 'concluido').length || 0;
      const f2InProgress = pipelinesData?.filter(p => p.fase_grupo === 'fase_2' && p.ano_referencia === currentYear && p.status === 'em_andamento').length || 0;

      const f3Done = pipelinesData?.filter(p => p.fase_grupo === 'fase_3' && p.ano_referencia === currentYear && p.status === 'concluido').length || 0;
      const f3InProgress = pipelinesData?.filter(p => p.fase_grupo === 'fase_3' && p.ano_referencia === currentYear && p.status === 'em_andamento').length || 0;

      setStats({
        totalClients: totalClientsCount,
        totalRaizCnpj: totalRaizCount,
        fase1Concluidos: f1Done,
        fase1EmAndamento: f1InProgress,
        fase2ConcluidosAno: f2Done,
        fase2EmAndamentoAno: f2InProgress,
        fase3ConcluidosAno: f3Done,
        fase3EmAndamentoAno: f3InProgress,
        matrixConforme: conformeCount,
        matrixPendente: pendentesCount,
        matrixCritico: criticosCount,
        totalPocs: totalPocsCount,
        pocsEmAndamento: pocsEmAndamentoCount,
        pocsConvertidas: pocsConvertidasCount,
        taxaConversaoPoc
      });

      // Mapear dados da Timeline Resumida por Raiz do CNPJ / Grupo (Item 11)
      const groupsMap: Record<string, {
        raizCnpj: string;
        nomeGrupo?: string | null;
        razaoSocial: string;
        qtdFiliais: number;
        inicio?: string;
        fim?: string;
        status: string;
        greenStepsTotal: number;
        maxStepsTotal: number;
      }> = {};

      const totalFase1Steps = (phasesData || []).filter((p: WorkflowPhase) => p.grupo_fase === 'fase_1').length || 7;

      (clientsData || []).forEach(c => {
        const clean = (c.cnpj || '').replace(/\D/g, '');
        const raiz = clean.slice(0, 8) || c.id;
        const pipe1 = pipelinesData?.find(p => p.client_id === c.id && p.fase_grupo === 'fase_1');

        // Calcular etapas em verde ou etapa atual
        const statusMap = pipe1?.status_etapas || {};
        let greenSteps = Object.values(statusMap).filter(s => s === 'verde').length;
        if (greenSteps === 0 && pipe1) {
          if (pipe1.status === 'concluido') greenSteps = totalFase1Steps;
          else if (pipe1.etapa_atual > 1) greenSteps = Math.min(totalFase1Steps, pipe1.etapa_atual - 1);
        }

        if (!groupsMap[raiz]) {
          groupsMap[raiz] = {
            raizCnpj: raiz.length === 8 ? `${raiz.slice(0,2)}.${raiz.slice(2,5)}.${raiz.slice(5,8)}` : raiz,
            nomeGrupo: c.nome_grupo || null,
            razaoSocial: c.razao_social,
            qtdFiliais: 1,
            inicio: pipe1?.start_as_is || undefined,
            fim: pipe1?.start_to_be || undefined,
            status: pipe1?.status || 'iniciado',
            greenStepsTotal: greenSteps,
            maxStepsTotal: totalFase1Steps
          };
        } else {
          groupsMap[raiz].qtdFiliais += 1;
          groupsMap[raiz].greenStepsTotal += greenSteps;
          groupsMap[raiz].maxStepsTotal += totalFase1Steps;

          if (c.nome_grupo && !groupsMap[raiz].nomeGrupo) {
            groupsMap[raiz].nomeGrupo = c.nome_grupo;
          }
          if (pipe1?.start_as_is && !groupsMap[raiz].inicio) {
            groupsMap[raiz].inicio = pipe1.start_as_is;
          }
          if (pipe1?.start_to_be && !groupsMap[raiz].fim) {
            groupsMap[raiz].fim = pipe1.start_to_be;
          }
        }
      });

      const timelineData = Object.values(groupsMap).map(g => {
        const pct = g.maxStepsTotal > 0 ? Math.round((g.greenStepsTotal / g.maxStepsTotal) * 100) : 0;
        return {
          id: g.raizCnpj,
          nomeGrupo: g.nomeGrupo || '-',
          razaoSocial: g.razaoSocial,
          raizCnpj: g.raizCnpj,
          qtdFiliais: g.qtdFiliais,
          inicio: g.inicio,
          fim: g.fim,
          status: g.status,
          greenSteps: g.greenStepsTotal,
          maxSteps: g.maxStepsTotal,
          pctProgress: pct
        };
      });
      setProjectsTimeline(timelineData);

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
        let concluidasCount = 0;
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

            const isStepConcluded = pipeF1?.status === 'concluido' || (pipeF1?.etapa_atual ? phase.ordem < pipeF1.etapa_atual : false);

            if (principalId === member.id) {
              principaisCount++;
              if (isStepConcluded) {
                concluidasCount++;
              } else if (pipeF1?.etapa_atual === phase.ordem && pipeF1?.status !== 'concluido') {
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

              const isStepConcluded = pipeF2?.status === 'concluido' || (pipeF2?.status === 'em_andamento' && phase.ordem < (pipeF2.etapa_atual || 1));

              if (principalId === member.id) {
                principaisCount++;
                if (isStepConcluded) {
                  concluidasCount++;
                } else if (pipeF2?.etapa_atual === phase.ordem && pipeF2?.status === 'em_andamento') {
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

              const isStepConcluded = pipeF3?.status === 'concluido';

              if (principalId === member.id) {
                principaisCount++;
                if (isStepConcluded) {
                  concluidasCount++;
                } else if (pipeF3?.etapa_atual === phase.ordem && pipeF3?.status === 'em_andamento') {
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
          totalAtribuicoes: principaisCount,
          concluidasAtribuicoes: concluidasCount,
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
      {/* ──────── Cabeçalho Hero do Dashboard Geral ──────── */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden animate-in fade-in duration-300">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner shrink-0">
            <LayoutDashboard className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 uppercase tracking-wider">
                Visão Executiva 360°
              </span>
            </div>
            <h1 className="text-2xl font-black text-white mt-1 tracking-tight">
              Dashboard Geral
            </h1>
            <p className="text-xs text-indigo-100/80 mt-1 max-w-xl">
              Consolidado executivo integrado dos módulos <strong>Checklist Fiscal</strong>, <strong>Cliente Recorrente</strong> e <strong>POC</strong>.
            </p>
          </div>
        </div>

        {/* 5 Métricas Rápidas & Atualizar no Header */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 relative z-10 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2.5 bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/10">
            {/* Metric 1: Total Empresas */}
            <div className="flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider">Empresas</span>
                <div className="text-xl font-black text-white mt-0.5"><AnimatedCounter end={stats.totalClients} /></div>
                <span className="text-[10px] text-indigo-200">{stats.totalRaizCnpj} Grupos</span>
              </div>
              <Link to="/clientes" className="mt-2 text-[10px] text-indigo-300 hover:text-white font-semibold flex items-center gap-0.5 transition-colors">
                Ver <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Metric 2: Diagnóstico (Fase 1) */}
            <div className="flex flex-col justify-between border-l border-white/10 pl-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider">Diagnóstico</span>
                <div className="text-xl font-black text-indigo-200 mt-0.5"><AnimatedCounter end={stats.fase1Concluidos} /> / {stats.totalClients}</div>
                <span className="text-[10px] text-indigo-300/80">{stats.fase1EmAndamento} em andamento</span>
              </div>
              <Link to="/fluxo-de-trabalho" className="mt-2 text-[10px] text-indigo-300 hover:text-white font-semibold flex items-center gap-0.5 transition-colors">
                Ver <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Metric 3: Plano de Ação (Fase 2) */}
            <div className="flex flex-col justify-between border-l border-white/10 pl-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-blue-300 tracking-wider">Plano Ação</span>
                <div className="text-xl font-black text-blue-200 mt-0.5"><AnimatedCounter end={stats.fase2ConcluidosAno} /></div>
                <span className="text-[10px] text-blue-300/80">{stats.fase2EmAndamentoAno} em andamento ({currentYear})</span>
              </div>
              <Link to="/fluxo-de-trabalho" className="mt-2 text-[10px] text-blue-300 hover:text-white font-semibold flex items-center gap-0.5 transition-colors">
                Ver <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Metric 4: Governança (Fase 3) */}
            <div className="flex flex-col justify-between border-l border-white/10 pl-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider">Governança</span>
                <div className="text-xl font-black text-emerald-400 mt-0.5"><AnimatedCounter end={stats.fase3ConcluidosAno} /></div>
                <span className="text-[10px] text-emerald-300/80">{stats.fase3EmAndamentoAno} em andamento ({currentYear})</span>
              </div>
              <Link to="/fluxo-de-trabalho" className="mt-2 text-[10px] text-emerald-300 hover:text-white font-semibold flex items-center gap-0.5 transition-colors">
                Ver <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Metric 5: Esteira POC */}
            <div className="flex flex-col justify-between border-l border-white/10 pl-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-300 tracking-wider">Esteira POC</span>
                <div className="text-xl font-black text-amber-300 mt-0.5"><AnimatedCounter end={stats.pocsEmAndamento} /></div>
                <span className="text-[10px] text-amber-200/80">{stats.taxaConversaoPoc}% Conv. ({stats.pocsConvertidas}/{stats.totalPocs})</span>
              </div>
              <Link to="/poc" className="mt-2 text-[10px] text-amber-300 hover:text-white font-semibold flex items-center gap-0.5 transition-colors">
                Ver <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-2xl text-xs font-semibold backdrop-blur-md transition-colors cursor-pointer shrink-0"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-300' : 'text-indigo-300'}`} />
            <span>Atualizar</span>
          </button>
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
          {/* Clientes por Regime Tributário Card */}
          <div className="bg-white rounded-2xl shadow-2xs p-5 flex flex-col border border-slate-200 justify-between h-[290px]">
            <div className="flex flex-col mb-2">
              <h3 className="text-base font-bold text-slate-900">Clientes por Regime Tributário</h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">Origem: <strong className="text-slate-700">clients.regime</strong></p>
            </div>
            <div className="flex-1 flex flex-col justify-around gap-2.5">
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                    Regime Regular (Normal)
                  </span>
                  <span className="font-semibold text-slate-900">{segmentStats.industria}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-full transition-all duration-500" 
                    style={{ width: `${stats.totalClients ? (segmentStats.industria / stats.totalClients) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                    Regimes Específicos
                  </span>
                  <span className="font-semibold text-slate-900">{segmentStats.comercio}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-purple-600 h-full transition-all duration-500" 
                    style={{ width: `${stats.totalClients ? (segmentStats.comercio / stats.totalClients) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                    Regimes Diferenciados
                  </span>
                  <span className="font-semibold text-slate-900">{segmentStats.servico}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-600 h-full transition-all duration-500" 
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
                userActivityStats.map((item) => {
                  const pct = item.totalAtribuicoes > 0 
                    ? Math.round((item.concluidasAtribuicoes / item.totalAtribuicoes) * 100)
                    : 0;
                  
                  return (
                    <div key={item.id} className="space-y-1.5 p-2 rounded-xl bg-slate-50/70 border border-slate-100 hover:bg-slate-100/80 transition-colors">
                      <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 truncate max-w-[140px]" title={item.usuario}>
                            {item.usuario}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">{item.cargo}</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="font-bold text-slate-900 text-xs flex items-center gap-0.5">
                            <span className={item.concluidasAtribuicoes > 0 ? "text-emerald-600 font-extrabold" : "text-slate-900 font-bold"}>
                              {item.concluidasAtribuicoes}
                            </span>
                            <span className="text-slate-400 font-normal">/</span>
                            <span>{item.totalAtribuicoes}</span>
                            <span className="text-[10px] font-normal text-slate-500 ml-1">etapas</span>
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {item.totalAtribuicoes > 0 ? `${pct}% concluído` : 'Sem etapas'}
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-full transition-all duration-500 rounded-full"
                          style={{ width: item.totalAtribuicoes > 0 ? `${Math.max(item.concluidasAtribuicoes > 0 ? 4 : 0, pct)}%` : '0%' }}
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

      {/* ──────── Timeline Resumida dos Projetos (Item 11) ──────── */}
      <div className="bg-white rounded-2xl p-6 shadow-2xs border border-slate-200 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-600" />
              Timeline Resumida dos Projetos (Diagnóstico)
            </h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Alimentado por Start AS-IS e Start TO-BE do Fluxo de Trabalho
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Filtro por Grupo / Projeto ou Raiz CNPJ */}
            <div className="relative">
              <input
                type="text"
                placeholder="Filtrar por Grupo, Projeto ou Raiz CNPJ..."
                value={timelineSearch}
                onChange={(e) => setTimelineSearch(e.target.value)}
                className="w-72 h-9 pl-9 pr-4 rounded-full bg-slate-100 text-xs text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-purple-100 focus:border-purple-300 border border-transparent transition-all placeholder:text-slate-400"
              />
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            <Link to="/fluxo-de-trabalho" className="text-xs font-semibold text-purple-600 hover:text-purple-800 flex items-center gap-1 shrink-0">
              Ver Fluxo <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[480px] overflow-y-auto scrollbar-thin rounded-xl border border-slate-100">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 shadow-2xs">
              <tr className="text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <th className="py-2.5 px-4 bg-slate-50">Grupo Econômico</th>
                <th className="py-2.5 px-4 bg-slate-50">Empresa</th>
                <th className="py-2.5 px-4 text-center bg-slate-50">Qtd. Empresas</th>
                <th className="py-2.5 px-4 text-center bg-slate-50">Raiz CNPJ</th>
                <th className="py-2.5 px-4 text-center bg-slate-50">Start AS-IS</th>
                <th className="py-2.5 px-4 text-center bg-slate-50">Start TO-BE</th>
                <th className="py-2.5 px-4 bg-slate-50">Progresso do Diagnóstico</th>
                <th className="py-2.5 px-4 text-center bg-slate-50">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs bg-white">
              {projectsTimeline.filter((item) => {
                const searchLower = timelineSearch.toLowerCase();
                const cleanSearch = timelineSearch.replace(/\D/g, '');
                const cleanRaiz = item.raizCnpj.replace(/\D/g, '');

                const matchesGroup = item.nomeGrupo.toLowerCase().includes(searchLower);
                const matchesName = item.razaoSocial.toLowerCase().includes(searchLower);
                const matchesRaiz = item.raizCnpj.toLowerCase().includes(searchLower) || (cleanSearch.length > 0 && cleanRaiz.includes(cleanSearch));

                return matchesGroup || matchesName || matchesRaiz;
              }).map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 font-semibold text-indigo-900">{item.nomeGrupo}</td>
                  <td className="py-3 px-4 font-bold text-slate-800">{item.razaoSocial}</td>
                  <td className="py-3 px-4 text-center font-semibold text-slate-700">
                    <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-100 border border-slate-200 text-slate-700 font-mono">
                      {item.qtdFiliais} {item.qtdFiliais > 1 ? 'filiais' : 'matriz'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-indigo-700 font-semibold">{item.raizCnpj}</td>
                  <td className="py-3 px-4 text-center font-mono text-slate-600">{item.inicio ? item.inicio.split('-').reverse().join('/') : '--/--'}</td>
                  <td className="py-3 px-4 text-center font-mono text-slate-600">{item.fim ? item.fim.split('-').reverse().join('/') : '--/--'}</td>
                  <td className="py-3 px-4 min-w-[160px]">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[10px] font-semibold text-slate-600">
                        <span>{item.greenSteps}/{item.maxSteps} Etapas</span>
                        <span className="text-purple-700 font-bold">{item.pctProgress}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
                        <div 
                          className="bg-purple-600 h-full rounded-full transition-all duration-500"
                          style={{ width: `${item.pctProgress || 0}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center font-semibold text-slate-700 capitalize">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${item.status === 'concluido' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'}`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
