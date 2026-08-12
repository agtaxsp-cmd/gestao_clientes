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

      // 5. Volume de Atividades por Responsável (Matriz de Atribuições: Etapa 1 Checklist + Fluxos)
      const { data: teamMembersData } = await supabase.from('team_members').select('*');
      const { data: phasesData } = await supabase.from('workflow_phases').select('*').order('ordem', { ascending: true });
      const { data: assignmentsData } = await supabase.from('workflow_assignments').select('*');
      const { data: allPipelinesData } = await supabase.from('workflow_pipelines').select('*');

      const memberMap = new Map<string, string>();
      teamMembersData?.forEach(m => memberMap.set(m.id, m.nome));

      const assignMap = new Map<string, { principal?: string; backup?: string }>();
      assignmentsData?.forEach(a => {
        assignMap.set(a.fase_fluxo, {
          principal: a.responsavel_principal_id || undefined,
          backup: a.responsavel_backup_id || undefined
        });
      });

      const activePhases = (phasesData && phasesData.length > 0)
        ? phasesData
        : [
            { key: 'coleta_arquivos', ordem: 1 },
            { key: 'calculadora_rtc', ordem: 2 },
            { key: 'compliance_rtc', ordem: 3 },
            { key: 'apuracao_assistida', ordem: 4 },
            { key: 'entrega_apresentacao', ordem: 5 }
          ];

      const countsByUser: Record<string, number> = {};

      const addActivityForMember = (memberId?: string) => {
        if (!memberId) {
          countsByUser['Não Distribuído'] = (countsByUser['Não Distribuído'] || 0) + 1;
        } else {
          const userName = memberMap.get(memberId) || 'Não Distribuído';
          countsByUser[userName] = (countsByUser[userName] || 0) + 1;
        }
      };

      // Função utilitária: adiciona atividade para TODOS os responsáveis (Principal E Backup) configurados na fase
      const addActivityForPhase = (faseKey: string) => {
        const resp = assignMap.get(faseKey);
        if (!resp || (!resp.principal && !resp.backup)) {
          addActivityForMember(undefined);
        } else {
          if (resp.principal) addActivityForMember(resp.principal);
          if (resp.backup) addActivityForMember(resp.backup);
        }
      };

      // A. Volume Etapa 1 (Arquivos / Checklist Fiscal): cada registro de checklist representa volume atrelado aos responsáveis da Etapa 1
      const etapa1Key = activePhases[0]?.key || 'coleta_arquivos';
      const totalChecklists = matrixData?.length || 0;

      for (let i = 0; i < totalChecklists; i++) {
        addActivityForPhase(etapa1Key);
      }

      // B. Volume no Fluxo de Trabalho: contabilizar para todos os responsáveis das etapas ativas/disponíveis no fluxo
      const activePipelines = allPipelinesData?.filter(p => p.status !== 'concluido') || [];

      // 1) Esteiras ativas em andamento nas suas respectivas etapas do fluxo
      activePipelines.forEach(pipe => {
        const stepNum = pipe.etapa_atual || 2;
        const phaseObj = activePhases[stepNum - 1] || activePhases[1];
        if (phaseObj) {
          addActivityForPhase(phaseObj.key);
        }
      });

      // 2) Períodos com checklist completo disponíveis no fluxo (liberados a processar)
      matrixCompleta.forEach(m => {
        const hasPipeline = activePipelines.some(p => p.client_id === m.client_id && p.ano_referencia === m.ano_base && p.mes_referencia === m.mes_base);
        if (!hasPipeline) {
          // Se o período está completo no checklist, as etapas do fluxo (a partir da Etapa 2) estão disponíveis para os responsáveis configurados
          const etapa2Key = activePhases[1]?.key || 'calculadora_rtc';
          addActivityForPhase(etapa2Key);
        }
      });

      const userStatsArr = Object.entries(countsByUser)
        .map(([usuario, count]) => ({ usuario, count }))
        .sort((a, b) => b.count - a.count);

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
              <p className="text-xs text-slate-500 font-medium mt-0.5">Origem: Matriz de Atribuições (Etapa 1 Checklist + Fluxos)</p>
            </div>
            <div className="flex-1 flex flex-col justify-around gap-3">
              {userActivityStats.length === 0 ? (
                <div className="text-xs text-slate-400 italic text-center py-4">Sem atribuições no momento</div>
              ) : (
                userActivityStats.map((item, idx) => {
                  const maxCount = userActivityStats[0]?.count || 1;
                  const colors = ['bg-indigo-600', 'bg-sky-500', 'bg-amber-500', 'bg-emerald-600', 'bg-slate-600'];
                  return (
                    <div key={item.usuario} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium text-slate-700">
                        <span className="truncate max-w-[150px]" title={item.usuario}>{item.usuario}</span>
                        <span className="font-semibold text-slate-900">{item.count} atividade{item.count !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className={`${colors[idx % colors.length]} h-full transition-all duration-500`}
                          style={{ width: `${(item.count / maxCount) * 100}%` }}
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
