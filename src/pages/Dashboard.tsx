import { useEffect, useState } from 'react';
import { Users, RefreshCw, AlertTriangle, CheckCircle2, CheckCircle, AlertCircle, FileText, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ActivityLog } from '../types';

function AnimatedCounter({ end, duration = 1200 }: { end: number, duration?: number }) {
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
  const [stats, setStats] = useState({
    totalClients: 0,
    emAndamento: 0,
    pendentes: 0,
    criticos: 0
  });

  const [logs, setLogs] = useState<ActivityLog[]>([]);

  const [segmentStats, setSegmentStats] = useState<{ industria: number; comercio: number; servico: number }>({
    industria: 0,
    comercio: 0,
    servico: 0
  });

  const [userActivityStats, setUserActivityStats] = useState<{ usuario: string; count: number }[]>([]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // 1. Total Clientes e Segmentos
      const { data: clientsData, error: errC } = await supabase
        .from('clients')
        .select('segmento');
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

      // 3. Matriz de documentos fiscais
      const { data: matrixData, error: errM } = await supabase
        .from('fiscal_documents_matrix')
        .select('client_id, ano_base, mes_base, status_geral');
      if (errM) throw errM;

      const pendentesCount = matrixData?.filter(m => m.status_geral === 'pendente').length || 0;
      const criticosCount = matrixData?.filter(m => m.status_geral === 'atraso').length || 0;
      const matrixCompleta = matrixData?.filter(m => m.status_geral === 'completo') || [];

      // 2. Esteiras em andamento (apenas para períodos com checklist completo)
      const { data: pipelinesData, error: errP } = await supabase
        .from('workflow_pipelines')
        .select('client_id, ano_referencia, mes_referencia, status')
        .eq('status', 'em_andamento');
      if (errP) throw errP;

      const validEmAndamentoCount = pipelinesData?.filter(p =>
        matrixCompleta.some(m => m.client_id === p.client_id && m.ano_base === p.ano_referencia && m.mes_base === p.mes_referencia)
      ).length || 0;

      setStats({
        totalClients: totalClientsCount,
        emAndamento: validEmAndamentoCount,
        pendentes: pendentesCount,
        criticos: criticosCount
      });

      // 4. Logs de atividades recentes (feed de auditoria)
      const { data: logsData, error: errL } = await supabase
        .from('activity_logs')
        .select('*, clients(razao_social)')
        .order('created_at', { ascending: false })
        .limit(10);

      if (errL) throw errL;
      setLogs(logsData || []);

      // 5. Atividades por Responsável (Membros Cadastrados x Fluxos Disponíveis no Fluxo de Trabalho)
      const { data: teamMembersData } = await supabase.from('team_members').select('*').order('nome');
      const { data: assignmentsData } = await supabase.from('workflow_assignments').select('*');
      const { data: allPipelinesData } = await supabase.from('workflow_pipelines').select('*');

      // Esteiras ativas com checklist completo + períodos completos ainda sem esteira iniciada
      const activePipelines = (allPipelinesData || []).filter(p =>
        p.status !== 'concluido' &&
        matrixCompleta.some(m => m.client_id === p.client_id && m.ano_base === p.ano_referencia && m.mes_base === p.mes_referencia)
      );
      const unusedCompleteChecklists = matrixCompleta.filter(m => 
        !activePipelines.some(p => p.client_id === m.client_id && p.ano_referencia === m.ano_base && p.mes_referencia === m.mes_base)
      );

      const totalAvailableFlows = activePipelines.length + unusedCompleteChecklists.length;

      // Mapeia cada membro cadastrado e verifica se ele está atribuído como responsável (global ou customizado na esteira)
      const userStatsArr = (teamMembersData || []).map(member => {
        const isAssignedInFlow = assignmentsData?.some(a => 
          a.responsavel_principal_id === member.id || a.responsavel_backup_id === member.id
        ) || allPipelinesData?.some(p => {
          if (!p.responsaveis_etapas) return false;
          return Object.values(p.responsaveis_etapas as Record<string, { principal_id?: string; backup_id?: string }>).some(
            resp => resp?.principal_id === member.id || resp?.backup_id === member.id
          );
        });

        return {
          usuario: member.nome,
          count: isAssignedInFlow ? totalAvailableFlows : 0
        };
      }).sort((a, b) => b.count - a.count);

      setUserActivityStats(userStatsArr);
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
      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1 */}
        <div className="bg-white rounded-xl p-6 shadow-sm flex flex-col justify-between h-32 relative overflow-hidden group hover:shadow-md transition-shadow border border-slate-200">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-50 rounded-full group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center justify-between relative z-10">
            <span className="text-sm text-slate-500 font-medium">Total Clientes</span>
            <Users className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="relative z-10">
            <span className="text-3xl font-semibold text-slate-900">
              <AnimatedCounter end={stats.totalClients} duration={1000} />
            </span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-xl p-6 shadow-sm flex flex-col justify-between h-32 relative overflow-hidden group hover:shadow-md transition-shadow border border-slate-200">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-50 rounded-full group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center justify-between relative z-10">
            <span className="text-sm text-slate-500 font-medium">Esteiras em Andamento</span>
            <RefreshCw className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex items-center gap-2 relative z-10 mt-auto">
            <span className="text-3xl font-semibold text-slate-900">
              <AnimatedCounter end={stats.emAndamento} duration={1000} />
            </span>
            <div className="bg-amber-100 px-2 py-1 rounded-full">
              <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider">Em Andamento</span>
            </div>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-xl p-6 shadow-sm flex flex-col justify-between h-32 relative overflow-hidden group hover:shadow-md transition-shadow border border-slate-200">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-50 rounded-full group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center justify-between relative z-10">
            <span className="text-sm text-slate-500 font-medium">Matrizes com Pendência</span>
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex items-center gap-2 relative z-10 mt-auto">
            <span className="text-3xl font-semibold text-slate-900">
              <AnimatedCounter end={stats.pendentes} duration={1000} />
            </span>
            <div className="bg-amber-100 px-2 py-1 rounded-full">
              <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider">Pendente</span>
            </div>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white rounded-xl p-6 shadow-sm flex flex-col justify-between h-32 relative overflow-hidden group hover:shadow-md transition-shadow border border-slate-200">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-red-50 rounded-full group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center justify-between relative z-10">
            <span className="text-sm text-slate-500 font-medium">Matrizes Críticas (Atraso)</span>
            <AlertCircle className="w-5 h-5 text-red-500" />
          </div>
          <div className="flex items-center gap-2 relative z-10 mt-auto">
            <span className="text-3xl font-semibold text-slate-900">
              <AnimatedCounter end={stats.criticos} duration={1000} />
            </span>
            <div className="bg-red-100 px-2 py-1 rounded-full">
              <span className="text-[10px] font-semibold text-red-700 uppercase tracking-wider">Crítico</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Clientes por Segmento Card */}
          <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col border border-slate-200 justify-between">
            <div className="flex flex-col mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Clientes por Segmento</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Origem: Cadastro de Clientes (`clients`)</p>
            </div>
            <div className="flex-1 flex flex-col justify-around gap-3">
              <div className="space-y-1.5">
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

              <div className="space-y-1.5">
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

              <div className="space-y-1.5">
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

          {/* Atividades por Responsável Card */}
          <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col border border-slate-200 justify-between">
            <div className="flex flex-col mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Atividades por Responsável</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Origem: Responsáveis Cadastrados x Fluxos Disponíveis no Fluxo de Trabalho</p>
            </div>
            <div className="flex-1 flex flex-col justify-around gap-3">
              {userActivityStats.length === 0 ? (
                <div className="text-xs text-slate-400 italic text-center py-4">Nenhum responsável cadastrado</div>
              ) : (
                userActivityStats.map((item, idx) => {
                  const maxCount = userActivityStats[0]?.count || 1;
                  const colors = ['bg-indigo-600', 'bg-sky-500', 'bg-amber-500', 'bg-emerald-600', 'bg-slate-600'];
                  return (
                    <div key={item.usuario} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium text-slate-700">
                        <span className="truncate max-w-[150px]" title={item.usuario}>{item.usuario}</span>
                        <span className="font-semibold text-slate-900">{item.count} fluxo{item.count !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className={`${colors[idx % colors.length]} h-full transition-all duration-500`}
                          style={{ width: maxCount > 0 ? `${(item.count / maxCount) * 100}%` : '0%' }}
                        ></div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col h-[400px] border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Atividade Recente</h2>
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
              Carregando atividades...
            </div>
          ) : logs.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm text-center">
              Nenhuma atividade registrada na tabela activity_logs.
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-6 relative">
              <div className="absolute left-[11px] top-4 bottom-4 w-px bg-slate-200"></div>
              {logs.map((log) => (
                <div key={log.id} className="flex gap-4 relative">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 relative z-10 shadow-[0_0_0_4px_#ffffff]">
                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-700">
                      <span className="font-semibold text-slate-900">{log.clients?.razao_social || log.titulo}: </span> 
                      {log.descricao}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{new Date(log.created_at).toLocaleTimeString('pt-BR')}</p>
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
