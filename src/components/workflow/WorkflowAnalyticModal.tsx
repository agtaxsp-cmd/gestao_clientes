import { X, Compass, FileCheck, ShieldCheck, Check, Clock, Lock } from 'lucide-react';
import { Client, WorkflowPipeline, WorkflowPhase } from '../../types';
import { MESES } from './types';
import { cn } from '../../lib/utils';

export interface WorkflowAnalyticModalProps {
  client: Client;
  selectedYear: number;
  pipelines: WorkflowPipeline[];
  fasesDiagnostico: WorkflowPhase[];
  onClose: () => void;
}

export default function WorkflowAnalyticModal({
  client,
  selectedYear,
  pipelines,
  fasesDiagnostico,
  onClose
}: WorkflowAnalyticModalProps) {
  const getInitials = (name?: string) => {
    if (!name) return 'CL';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const getFase1Pipe = () => {
    return pipelines.find(p => p.client_id === client.id && p.fase_grupo === 'fase_1');
  };

  const getMonthlyPipe = (grupo: 'fase_2' | 'fase_3', month: number) => {
    return pipelines.find(
      p => p.client_id === client.id &&
           p.fase_grupo === grupo &&
           p.ano_referencia === selectedYear &&
           p.mes_referencia === month
    );
  };

  const f1Pipe = getFase1Pipe();
  const f2DoneCount = MESES.filter(m => getMonthlyPipe('fase_2', m.id)?.status === 'concluido').length;
  const f3DoneCount = MESES.filter(m => getMonthlyPipe('fase_3', m.id)?.status === 'concluido').length;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[92vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header Modal */}
        <div className="p-5 bg-gradient-to-r from-slate-50 via-white to-indigo-50/40 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center font-bold text-indigo-700 text-base shadow-2xs border border-indigo-200">
              {getInitials(client.razao_social)}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">{client.razao_social}</h3>
              <p className="text-xs text-slate-500 font-mono">
                CNPJ: {client.cnpj} • Visão Analítica das 3 Fases
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo Modal com Scroll */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {/* Bloco Fase 1 */}
          <div className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50/20 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-indigo-600" />
                <h4 className="text-sm font-bold text-slate-900">Fase 1 — Diagnóstico</h4>
              </div>
              <span className="text-xs font-semibold text-indigo-700">
                Status: {f1Pipe?.status || 'Iniciado'}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {fasesDiagnostico.map((p, idx) => {
                const isDone = (f1Pipe?.status === 'concluido') || (f1Pipe?.etapa_atual ? f1Pipe.etapa_atual > idx + 1 : false);
                const isCurrent = f1Pipe?.etapa_atual === idx + 1 && f1Pipe?.status !== 'concluido';

                return (
                  <div key={p.id} className={cn(
                    "p-2.5 rounded-xl border text-center flex flex-col items-center gap-1",
                    isDone ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
                    isCurrent ? "bg-white border-indigo-600 ring-2 ring-indigo-50 text-indigo-900 font-bold" :
                    "bg-white border-slate-200 text-slate-500"
                  )}>
                    <span className="text-[10px] font-mono font-bold">0{idx + 1}</span>
                    <span className="text-[11px] font-bold leading-tight">{p.nome}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bloco Fase 2 */}
          <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/20 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-blue-600" />
                <h4 className="text-sm font-bold text-slate-900">Fase 2 — Plano de Ação ({selectedYear})</h4>
              </div>
              <span className="text-xs font-semibold text-blue-700">
                {f2DoneCount}/12 Meses Concluídos
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              {MESES.map(m => {
                const p = getMonthlyPipe('fase_2', m.id);
                const isDone = p?.status === 'concluido';
                return (
                  <div key={m.id} className={cn(
                    "p-2 rounded-xl border flex items-center justify-between text-xs",
                    isDone ? "bg-emerald-50 border-emerald-200 font-bold text-emerald-800" :
                    p ? "bg-blue-50 border-blue-200 text-blue-800" : "bg-white border-slate-200 text-slate-500"
                  )}>
                    <span>{m.sigla}</span>
                    {isDone ? <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" /> : <Clock className="w-3.5 h-3.5 text-slate-400" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bloco Fase 3 */}
          <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/20 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h4 className="text-sm font-bold text-slate-900">Fase 3 — Governança ({selectedYear})</h4>
              </div>
              <span className="text-xs font-semibold text-emerald-700">
                {f3DoneCount}/12 Meses Auditados
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              {MESES.map(m => {
                const p = getMonthlyPipe('fase_3', m.id);
                const isDone = p?.status === 'concluido';
                return (
                  <div key={m.id} className={cn(
                    "p-2 rounded-xl border flex items-center justify-between text-xs",
                    isDone ? "bg-emerald-50 border-emerald-200 font-bold text-emerald-800" : "bg-white border-slate-200 text-slate-500"
                  )}>
                    <span>{m.sigla}</span>
                    {isDone ? <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" /> : <Lock className="w-3.5 h-3.5 text-slate-300" />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
