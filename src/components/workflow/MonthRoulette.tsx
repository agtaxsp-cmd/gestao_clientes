import { useState, useEffect, useRef } from 'react';
import { 
  Check, 
  Hourglass, 
  FileText, 
  ChevronRight, 
  ChevronLeft,
  ShieldCheck, 
  Clock 
} from 'lucide-react';
import { WorkflowPipeline, Client, WorkflowPhase } from '../../types';
import { MESES } from './types';
import { cn } from '../../lib/utils';

export interface MonthRouletteProps {
  client: Client;
  grupo: 'fase_2' | 'fase_3';
  selectedYear: number;
  pipelines: WorkflowPipeline[];
  fasesPlanoAcao: WorkflowPhase[];
  fasesGovernanca: WorkflowPhase[];
  onAdvance: (client: Client, grupo: 'fase_2' | 'fase_3', month: number, year: number) => void;
  onOpenDetail: (client: Client, grupo: 'fase_2' | 'fase_3', stepNum: number, month: number) => void;
}

export default function MonthRoulette({
  client,
  grupo,
  selectedYear,
  pipelines,
  fasesGovernanca = [],
  onAdvance,
  onOpenDetail
}: MonthRouletteProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const getMonthlyPipe = (month: number) => {
    return pipelines.find(
      p => p.client_id === client.id &&
           p.fase_grupo === grupo &&
           p.ano_referencia === selectedYear &&
           p.mes_referencia === month
    );
  };

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
  }, [pipelines, selectedYear]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const amount = direction === 'left' ? -340 : 340;
      scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
      setTimeout(checkScroll, 350);
    }
  };

  const scrollToMonth = (monthId: number) => {
    if (scrollRef.current) {
      const targetCard = scrollRef.current.querySelector(`[data-month="${monthId}"]`) as HTMLElement;
      if (targetCard) {
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  };

  return (
    <div className="flex flex-col gap-3 relative">
      {/* Barra de Navegação Rápida (Mini-chips com status dos 12 meses) + Setas da Roleta */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1">
        {/* Chips dos Meses */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {MESES.map((m) => {
            const pipe = getMonthlyPipe(m.id);
            const isConcluido = pipe?.status === 'concluido';
            const isAndamento = pipe?.status === 'em_andamento';

            return (
              <button
                key={m.id}
                type="button"
                onClick={() => scrollToMonth(m.id)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 border shadow-2xs",
                  isConcluido
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                    : isAndamento
                    ? "bg-blue-50 text-blue-700 border-blue-300 ring-1 ring-blue-200 hover:bg-blue-100"
                    : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                )}
                title={`Ir para ${m.nome}`}
              >
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  isConcluido ? "bg-emerald-500" : isAndamento ? "bg-blue-500 animate-pulse" : "bg-slate-300"
                )} />
                {m.sigla}
              </button>
            );
          })}
        </div>

        {/* Setas de Controle da Roleta */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => handleScroll('left')}
            disabled={!canScrollLeft}
            className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white text-slate-700 transition-all cursor-pointer shadow-2xs"
            title="Mês Anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleScroll('right')}
            disabled={!canScrollRight}
            className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white text-slate-700 transition-all cursor-pointer shadow-2xs"
            title="Próximo Mês"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Trilho Deslizante da Roleta */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex gap-3.5 overflow-x-auto pb-2 pt-1 scroll-smooth snap-x snap-mandatory scrollbar-none"
      >
        {MESES.map((m) => {
          const pipe = getMonthlyPipe(m.id);
          const isConcluido = pipe?.status === 'concluido';
          const step = pipe?.etapa_atual || 0;
          const isElaborarDone = isConcluido || step >= 2;
          const isAcompDone = isConcluido;

          return (
            <div
              key={m.id}
              data-month={m.id}
              className={cn(
                "w-64 shrink-0 snap-start p-4 rounded-2xl border flex flex-col justify-between gap-3 transition-all duration-300 relative overflow-hidden bg-white shadow-2xs hover:shadow-md",
                isConcluido ? "border-emerald-200 bg-gradient-to-b from-emerald-50/30 to-white" :
                pipe?.status === 'em_andamento' ? "border-blue-200 bg-gradient-to-b from-blue-50/20 to-white ring-1 ring-blue-100" :
                "border-slate-200 hover:border-slate-300"
              )}
            >
              {/* Header do Mês */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shadow-2xs",
                    isConcluido ? "bg-emerald-100 text-emerald-700" :
                    pipe?.status === 'em_andamento' ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
                  )}>
                    {m.id < 10 ? `0${m.id}` : m.id}
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900">{m.nome}</h5>
                    <span className="text-[10px] text-slate-400 font-mono">{selectedYear}</span>
                  </div>
                </div>
                <span className={cn(
                  "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border",
                  isConcluido ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                  pipe?.status === 'em_andamento' ? "bg-blue-50 text-blue-700 border-blue-200" :
                  "bg-slate-50 text-slate-500 border-slate-200"
                )}>
                  {isConcluido ? 'Concluído' : pipe ? 'Em Andamento' : 'Pendente'}
                </span>
              </div>

              {/* Corpo de Etapas */}
              {grupo === 'fase_2' ? (
                <div className="flex flex-col gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => onOpenDetail(client, grupo, 1, m.id)}
                    className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-50/80 hover:bg-indigo-50/80 border border-slate-100 hover:border-indigo-200 transition-all cursor-pointer text-left group/step"
                    title="Clique para gerenciar notas, arquivos e responsáveis da etapa 1"
                  >
                    <span className="font-semibold text-slate-700 group-hover/step:text-indigo-900">1. Elaborar</span>
                    {isElaborarDone ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                    ) : step === 1 ? (
                      <Hourglass className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-slate-400 group-hover/step:text-indigo-600" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenDetail(client, grupo, 2, m.id)}
                    className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-50/80 hover:bg-indigo-50/80 border border-slate-100 hover:border-indigo-200 transition-all cursor-pointer text-left group/step"
                    title="Clique para gerenciar notas, arquivos e responsáveis da etapa 2"
                  >
                    <span className="font-semibold text-slate-700 group-hover/step:text-indigo-900">2. Acompanhamento</span>
                    {isAcompDone ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                    ) : step === 2 ? (
                      <Hourglass className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-slate-400 group-hover/step:text-indigo-600" />
                    )}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 text-[11px]">
                  {fasesGovernanca.length > 0 ? (
                    fasesGovernanca.map((f, idx) => {
                      const stepIndex = idx + 1;
                      const isDone = isConcluido || step > stepIndex;
                      const isCurrent = step === stepIndex;

                      return (
                        <button
                          key={f.id || f.key || idx}
                          type="button"
                          onClick={() => onOpenDetail(client, grupo, stepIndex, m.id)}
                          className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-50/80 hover:bg-indigo-50/80 border border-slate-100 hover:border-indigo-200 transition-all cursor-pointer text-left group/step"
                          title={`Clique para gerenciar notas, arquivos e responsáveis de "${f.nome}"`}
                        >
                          <div className="flex items-center gap-2">
                            <ShieldCheck className={cn("w-3.5 h-3.5", isDone ? "text-emerald-600" : isCurrent ? "text-blue-600 font-bold" : "text-slate-400 group-hover/step:text-indigo-600")} />
                            <span className="font-semibold text-slate-700 group-hover/step:text-indigo-900 truncate max-w-[160px]">{stepIndex}. {f.nome}</span>
                          </div>
                          {isDone ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                          ) : isCurrent ? (
                            <Hourglass className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-slate-400 group-hover/step:text-indigo-600" />
                          )}
                        </button>
                      );
                    })
                  ) : (
                    <button
                      type="button"
                      onClick={() => onOpenDetail(client, grupo, 1, m.id)}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 hover:bg-indigo-50/80 border border-slate-100 hover:border-indigo-200 transition-all cursor-pointer text-left group/step"
                      title="Clique para gerenciar notas, arquivos e responsáveis da etapa"
                    >
                      <div className="flex items-center gap-2">
                        <ShieldCheck className={cn("w-4 h-4", isConcluido ? "text-emerald-600" : "text-slate-400 group-hover/step:text-indigo-600")} />
                        <span className="font-semibold text-slate-700 group-hover/step:text-indigo-900">Auditoria Fiscal</span>
                      </div>
                      {isConcluido ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-slate-400 group-hover/step:text-indigo-600" />
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Botões de Ação */}
              <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => onAdvance(client, grupo, m.id, selectedYear)}
                  className={cn(
                    "flex-1 py-1.5 rounded-xl text-xs font-semibold text-center transition-all cursor-pointer shadow-2xs flex items-center justify-center gap-1",
                    isConcluido ? "bg-slate-100 hover:bg-slate-200 text-slate-700" :
                    grupo === 'fase_2' ? "bg-blue-600 hover:bg-blue-700 text-white" :
                    "bg-emerald-600 hover:bg-emerald-700 text-white"
                  )}
                >
                  {isConcluido ? 'Reiniciar' : step === 0 ? 'Iniciar Mês' : 'Avançar Etapa'}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenDetail(client, grupo, Math.max(1, step), m.id)}
                  className="p-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-all cursor-pointer shadow-2xs"
                  title="Notas, arquivos e responsáveis do mês"
                >
                  <FileText className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
