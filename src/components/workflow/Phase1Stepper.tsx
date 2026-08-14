import { Check, Hourglass, Lock, ArrowRight, ArrowLeft, User, FileText } from 'lucide-react';
import { WorkflowPipeline, Client, WorkflowPhase, TeamMember, WorkflowAssignment } from '../../types';
import { cn } from '../../lib/utils';

export interface Phase1StepperProps {
  client: Client;
  pipeFase1?: WorkflowPipeline;
  fasesDiagnostico: WorkflowPhase[];
  members: TeamMember[];
  assignments: WorkflowAssignment[];
  onAdvance: (client: Client, currentPipe?: WorkflowPipeline) => void;
  onRegress: (client: Client, pipe: WorkflowPipeline) => void;
  onOpenDetail: (client: Client, grupo: 'fase_1', stepNum: number) => void;
}

export default function Phase1Stepper({
  client,
  pipeFase1,
  fasesDiagnostico,
  members,
  assignments,
  onAdvance,
  onRegress,
  onOpenDetail
}: Phase1StepperProps) {
  const isFase1Concluido = pipeFase1?.status === 'concluido';
  const f1StepNum = pipeFase1?.etapa_atual || 1;

  // Obter atribuição padrão da fase
  const getDefaultAssignment = (phaseKey: string) => {
    return assignments.find(a => a.fase_fluxo === phaseKey);
  };

  // Obter responsáveis de uma etapa
  const getStepResponsibles = (stepNum: number, phaseKey?: string) => {
    const stepKey = String(stepNum);
    const custom = pipeFase1?.responsaveis_etapas?.[stepKey];
    const defaultAssign = phaseKey ? getDefaultAssignment(phaseKey) : undefined;

    const principalId = (custom && custom.principal_id !== undefined)
      ? (custom.principal_id || '')
      : (defaultAssign?.responsavel_principal_id || '');

    const backupId = (custom && custom.backup_id !== undefined)
      ? (custom.backup_id || '')
      : (defaultAssign?.responsavel_backup_id || '');

    const principal = principalId ? members.find(m => m.id === principalId) : undefined;
    const backup = backupId ? members.find(m => m.id === backupId) : undefined;

    return { principalId, backupId, principal, backup };
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Etapas de Diagnóstico da empresa (7 etapas)</span>
        <span className="font-semibold text-slate-700">
          Status: <strong className={cn(isFase1Concluido ? "text-emerald-600" : "text-indigo-600")}>{pipeFase1?.status || 'Iniciado'}</strong>
        </span>
      </div>

      {/* Stepper Timeline Horizontal */}
      <div className="relative w-full py-2 overflow-x-auto scrollbar-none">
        {/* Linha de fundo */}
        <div className="absolute top-[20px] left-6 right-6 h-1 bg-slate-100 -translate-y-1/2 z-0 rounded-full"></div>
        {/* Linha de progresso */}
        <div 
          className={cn(
            "absolute top-[20px] left-6 h-1 -translate-y-1/2 z-0 rounded-full transition-all duration-500",
            isFase1Concluido ? "bg-emerald-500" : "bg-indigo-600"
          )}
          style={{
            width: isFase1Concluido 
              ? 'calc(100% - 3rem)' 
              : `calc(${Math.round(((f1StepNum - 1) / Math.max(1, (fasesDiagnostico.length || 7) - 1)) * 100)}% * 0.9 + 5%)`
          }}
        ></div>

        {/* Grid das 7 etapas */}
        <div 
          className="grid gap-2 relative z-10 w-full min-w-[700px]"
          style={{ gridTemplateColumns: `repeat(${fasesDiagnostico.length || 7}, minmax(0, 1fr))` }}
        >
          {fasesDiagnostico.map((phaseObj, index) => {
            const stepNum = index + 1;
            const isCompleted = stepNum < f1StepNum || isFase1Concluido;
            const isCurrent = stepNum === f1StepNum && !isFase1Concluido;
            const isLocked = stepNum > f1StepNum;
            const assign = getStepResponsibles(stepNum, phaseObj.key);

            return (
              <div
                key={phaseObj.id || phaseObj.key}
                onClick={() => onOpenDetail(client, 'fase_1', stepNum)}
                className={cn(
                  "flex flex-col items-center gap-1.5 cursor-pointer p-2 rounded-xl hover:bg-slate-50 transition-all group/step",
                  isLocked && "opacity-60"
                )}
                title={`Clique para ver detalhes, responsáveis e caminhos de rede da etapa ${stepNum}`}
              >
                {/* Círculo da Etapa */}
                <div className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center shadow-xs transition-all shrink-0 group-hover/step:scale-110",
                  isCompleted ? "bg-emerald-500 text-white" :
                  isCurrent ? "bg-white border-2 border-indigo-600 shadow-md ring-4 ring-indigo-50 text-indigo-600 font-bold text-xs" :
                  "bg-slate-100 border border-slate-200 text-slate-400 font-medium text-xs"
                )}>
                  {isCompleted && <Check className="w-4 h-4 text-white stroke-[3]" />}
                  {isCurrent && <Hourglass className="w-4 h-4 text-indigo-600 animate-spin" />}
                  {isLocked && <Lock className="w-3.5 h-3.5 text-slate-400" />}
                </div>

                {/* Nome da Etapa */}
                <span className={cn(
                  "text-[11px] font-bold text-center leading-tight mt-0.5",
                  isCurrent ? "text-indigo-700" : isCompleted ? "text-slate-800" : "text-slate-500"
                )}>
                  {phaseObj.nome}
                </span>

                {/* Responsável Pill */}
                <div className="w-full flex flex-col items-center text-[10px] text-slate-500 bg-slate-50/80 px-1.5 py-0.5 rounded-md border border-slate-100 group-hover/step:border-indigo-200 transition-colors">
                  {assign.principal ? (
                    <span className="flex items-center gap-1 font-semibold text-slate-700 truncate max-w-[110px]">
                      <User className="w-2.5 h-2.5 text-indigo-600 shrink-0" />
                      {assign.principal.nome.split(' ')[0]}
                    </span>
                  ) : (
                    <span className="text-slate-400 italic text-[9px]">Sem resp.</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Barra de Ações Fase 1 */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
        <div className="text-xs text-slate-600 flex items-center gap-2">
          <span className="font-semibold text-slate-800">Mensagem:</span>
          <span>{pipeFase1?.mensagem_info || 'Diagnóstico pronto para acompanhamento'}</span>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {pipeFase1 && (pipeFase1.etapa_atual > 1 || isFase1Concluido) && (
            <button
              onClick={() => onRegress(client, pipeFase1)}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar Etapa
            </button>
          )}

          {!isFase1Concluido && (
            <button
              onClick={() => onAdvance(client, pipeFase1)}
              className="px-4 py-1.5 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <span>Avançar Etapa</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => onOpenDetail(client, 'fase_1', f1StepNum)}
            className="px-3.5 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <FileText className="w-3.5 h-3.5" />
            Detalhes & Notas
          </button>
        </div>
      </div>
    </div>
  );
}
