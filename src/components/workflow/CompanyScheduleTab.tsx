import { Calendar, Clock, ArrowRight } from 'lucide-react';
import { Client, WorkflowPipeline, WorkflowPhase } from '../../types';
import { cn } from '../../lib/utils';

export interface CompanyScheduleTabProps {
  client: Client;
  pipeFase1?: WorkflowPipeline;
  fasesDiagnostico: WorkflowPhase[];
  onOpenDetail: (stepNum: number) => void;
}

export default function CompanyScheduleTab({
  client,
  pipeFase1,
  fasesDiagnostico,
  onOpenDetail
}: CompanyScheduleTabProps) {
  const startAsIs = pipeFase1?.start_as_is;
  const startToBe = pipeFase1?.start_to_be;
  const datasEtapas = pipeFase1?.datas_etapas || {};
  const statusEtapas = pipeFase1?.status_etapas || {};

  // Formatação amigável de data
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '--/--';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
    return dateStr;
  };

  // Cálculo da diferença em dias entre duas datas
  const calculateDays = (start?: string | null, end?: string | null) => {
    if (!start || !end) return null;
    const d1 = new Date(start);
    const d2 = new Date(end);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Calcular total de dias do projeto (da 1ª etapa à última)
  let totalDiasProjeto = 0;

  fasesDiagnostico.forEach((_, idx) => {
    const stepNum = idx + 1;
    const dates = datasEtapas[String(stepNum)];
    if (dates?.data_inicio && dates?.data_fim) {
      const days = calculateDays(dates.data_inicio, dates.data_fim);
      if (days !== null) {
        totalDiasProjeto += days;
      }
    }
  });

  return (
    <div className="flex flex-col gap-6">
      {/* ──────── Header dos Marcos Principais (Start AS-IS & Start TO-BE) ──────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card Start AS-IS */}
        <div className="bg-gradient-to-br from-indigo-50/80 to-white p-4 rounded-2xl border border-indigo-100 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Start AS-IS (Após Outorga)
              </span>
              <span className="text-base font-extrabold text-indigo-950">
                {formatDate(startAsIs)}
              </span>
            </div>
          </div>
        </div>

        {/* Card Start TO-BE */}
        <div className="bg-gradient-to-br from-purple-50/80 to-white p-4 rounded-2xl border border-purple-100 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Start TO-BE (Após Pres. AS-IS)
              </span>
              <span className="text-base font-extrabold text-purple-950">
                {formatDate(startToBe)}
              </span>
            </div>
          </div>
        </div>

        {/* Card Total de Dias Planejados */}
        <div className="bg-gradient-to-br from-emerald-50/80 to-white p-4 rounded-2xl border border-emerald-100 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Tempo Estimado Diagnóstico
              </span>
              <span className="text-base font-extrabold text-emerald-950">
                {totalDiasProjeto > 0 ? `${totalDiasProjeto} dias` : 'Não calculado'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ──────── Tabela Estilo Planilha de Cronograma (Fase 1) ──────── */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-600" />
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Detalhamento por Etapa — {client.razao_social} ({client.segmento.toUpperCase()})
            </h4>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            Preenchimento manual via detalhes da etapa
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/60 text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                <th className="px-4 py-3 text-center w-12">#</th>
                <th className="px-4 py-3">Etapa do Diagnóstico</th>
                <th className="px-4 py-3 text-center">Data Início</th>
                <th className="px-4 py-3 text-center">Data Fim</th>
                <th className="px-4 py-3 text-center">Duração (Dias)</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100">
              {fasesDiagnostico.map((phaseObj, index) => {
                const stepNum = index + 1;
                const stepKey = String(stepNum);
                const dates = datasEtapas[stepKey];
                const statusColor = statusEtapas[stepKey] || 'pendente';
                const days = calculateDays(dates?.data_inicio, dates?.data_fim);

                return (
                  <tr key={phaseObj.id || phaseObj.key} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 text-center font-bold text-slate-500">{stepNum}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{phaseObj.nome}</td>
                    <td className="px-4 py-3 text-center font-mono text-slate-600">
                      {formatDate(dates?.data_inicio)}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-slate-600">
                      {formatDate(dates?.data_fim)}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-indigo-700">
                      {days !== null ? `${days} dias` : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase inline-flex items-center gap-1",
                        statusColor === 'verde' && "bg-emerald-100 text-emerald-800 border border-emerald-200",
                        statusColor === 'amarelo' && "bg-amber-100 text-amber-800 border border-amber-200",
                        statusColor === 'vermelho' && "bg-red-100 text-red-800 border border-red-200",
                        statusColor === 'pendente' && "bg-slate-100 text-slate-600 border border-slate-200"
                      )}>
                        <span className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          statusColor === 'verde' && "bg-emerald-500",
                          statusColor === 'amarelo' && "bg-amber-500",
                          statusColor === 'vermelho' && "bg-red-500",
                          statusColor === 'pendente' && "bg-slate-400"
                        )} />
                        {statusColor === 'verde' ? 'Concluído' : statusColor === 'amarelo' ? 'Em Andamento' : statusColor === 'vermelho' ? 'Crítico' : 'Pendente'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onOpenDetail(stepNum)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <span>Editar Datas</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
