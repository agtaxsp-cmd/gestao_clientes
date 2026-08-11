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

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // 1. Total Clientes
      const { count: countClients, error: errC } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true });
      if (errC) throw errC;

      // 2. Esteiras em andamento
      const { count: countPipelines, error: errP } = await supabase
        .from('workflow_pipelines')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'em_andamento');
      if (errP) throw errP;

      // 3. Matriz com pendências ou críticas
      const { data: matrixData, error: errM } = await supabase
        .from('fiscal_documents_matrix')
        .select('status_geral');
      if (errM) throw errM;

      const pendentesCount = matrixData?.filter(m => m.status_geral === 'pendente').length || 0;
      const criticosCount = matrixData?.filter(m => m.status_geral === 'atraso').length || 0;

      setStats({
        totalClients: countClients || 0,
        emAndamento: countPipelines || 0,
        pendentes: pendentesCount,
        criticos: criticosCount
      });

      // 4. Logs de atividades
      const { data: logsData, error: errL } = await supabase
        .from('activity_logs')
        .select('*, clients(razao_social)')
        .order('created_at', { ascending: false })
        .limit(10);

      if (errL) throw errL;
      setLogs(logsData || []);
    } catch (err: any) {
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
          {/* Chart Card */}
          <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Métricas Globais</h3>
            <div className="flex-1 flex flex-col justify-center items-center py-6 gap-4">
              <div className="w-32 h-32 rounded-full border-[12px] border-indigo-600 flex items-center justify-center relative">
                <span className="text-2xl font-bold text-slate-900">{stats.totalClients}</span>
              </div>
              <span className="text-xs text-slate-500 font-medium">Clientes Cadastrados no Banco</span>
            </div>
          </div>

          {/* Pending Tasks Bars */}
          <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Resumo da Carteira</h3>
            <div className="flex-1 flex flex-col justify-around gap-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium text-slate-700">
                  <span>Clientes Ativos</span>
                  <span>{stats.totalClients}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 h-full w-[100%]"></div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium text-slate-700">
                  <span>Em Esteira Ativa</span>
                  <span>{stats.emAndamento}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-amber-400 h-full" style={{ width: `${stats.totalClients ? (stats.emAndamento / stats.totalClients) * 100 : 0}%` }}></div>
                </div>
              </div>
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
