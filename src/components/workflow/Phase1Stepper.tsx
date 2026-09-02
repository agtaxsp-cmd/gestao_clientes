import React, { useState } from 'react';
import { Check, ArrowRight, ArrowLeft, User, FileText, Calendar, Edit3, X, Ban } from 'lucide-react';
import { WorkflowPipeline, Client, WorkflowPhase, TeamMember, WorkflowAssignment, EtapaColorStatus, normalizeStepStatus, STEP_STATUS_MAP } from '../../types';
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
  onUpdateStepStatus?: (stepNum: number, newStatus: EtapaColorStatus) => void;
  onSavePeriodoEscopo?: (periodo: string) => void;
}

export default function Phase1Stepper({
  client,
  pipeFase1,
  fasesDiagnostico,
  members,
  assignments,
  onAdvance,
  onRegress,
  onOpenDetail,
  onSavePeriodoEscopo
}: Phase1StepperProps) {
  const isFase1Concluido = pipeFase1?.status === 'concluido';
  const f1StepNum = pipeFase1?.etapa_atual || 1;
  const statusEtapas = pipeFase1?.status_etapas || {};
  const periodoEscopo = pipeFase1?.periodo_escopo || '';

  const [editingEscopo, setEditingEscopo] = useState(false);
  const [tempEscopo, setTempEscopo] = useState(periodoEscopo);

  const handleSaveEscopo = () => {
    if (onSavePeriodoEscopo) {
      onSavePeriodoEscopo(tempEscopo);
    }
    setEditingEscopo(false);
  };

  // Obter atribuição padrão da fase
  const getDefaultAssignment = (phaseKey: string) => {
    return assignments.find(a => a.fase_fluxo === phaseKey);
  };

  // Obter responsáveis de uma etapa
  const getStepResponsibles = (stepNum: number, phaseKey?: string) => {
    const stepKey = String(stepNum);
    const customMultiples = pipeFase1?.responsaveis_multiplos_etapas?.[stepKey];
    const custom = pipeFase1?.responsaveis_etapas?.[stepKey];
    const defaultAssign = phaseKey ? getDefaultAssignment(phaseKey) : undefined;

    if (customMultiples && customMultiples.length > 0) {
      const assignedMembers = customMultiples.map(id => members.find(m => m.id === id)).filter(Boolean) as TeamMember[];
      return { assignedMembers };
    }

    const principalId = (custom && custom.principal_id !== undefined)
      ? (custom.principal_id || '')
      : (defaultAssign?.responsavel_principal_id || '');

    const principal = principalId ? members.find(m => m.id === principalId) : undefined;
    return { assignedMembers: principal ? [principal] : [] };
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Cabeçalho com Período do Escopo (Preenchimento Manual - Item 3) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-500 bg-gradient-to-r from-slate-50 to-indigo-50/30 p-3 rounded-xl border border-slate-200 gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
          <span className="font-bold text-slate-700">Período do Escopo:</span>
          {editingEscopo ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={tempEscopo}
                onChange={(e) => setTempEscopo(e.target.value)}
                placeholder="Ex: Jan/2023 a Dez/2024"
                className="px-2 py-0.5 border border-indigo-300 rounded text-xs bg-white text-slate-900 outline-none"
                autoFocus
              />
              <button
                onClick={handleSaveEscopo}
                className="px-2 py-0.5 bg-indigo-600 text-white font-semibold rounded text-[11px]"
              >
                Salvar
              </button>
              <button
                onClick={() => setEditingEscopo(false)}
                className="p-0.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-indigo-900 bg-white px-2 py-0.5 rounded border border-indigo-100 shadow-2xs">
                {periodoEscopo || 'Não informado (Clique para editar)'}
              </span>
              <button
                onClick={() => {
                  setTempEscopo(periodoEscopo);
                  setEditingEscopo(true);
                }}
                className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                title="Editar Período do Escopo"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-500">Status Geral:</span>
          <strong className={cn("font-bold uppercase", isFase1Concluido ? "text-emerald-600" : "text-indigo-600")}>
            {pipeFase1?.status || 'Iniciado'}
          </strong>
        </div>
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
            const stepKey = String(stepNum);
            const rawStatus = statusEtapas[stepKey];
            const stepStatus = rawStatus
              ? normalizeStepStatus(rawStatus)
              : (stepNum < f1StepNum || isFase1Concluido ? 'concluido' : 'pendente');

            const assign = getStepResponsibles(stepNum, phaseObj.key);
            const statusMeta = STEP_STATUS_MAP[stepStatus];

            return (
              <div
                key={phaseObj.id || phaseObj.key}
                onClick={() => onOpenDetail(client, 'fase_1', stepNum)}
                className="flex flex-col items-center gap-1.5 cursor-pointer p-2 rounded-xl hover:bg-slate-50 transition-all group/step"
                title={`Etapa ${stepNum}: ${phaseObj.nome} (${statusMeta?.label || stepStatus})`}
              >
                {/* Círculo da Etapa */}
                <div
                  className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center shadow-xs transition-all shrink-0 group-hover/step:scale-105",
                    stepStatus === 'concluido' && "bg-emerald-500 text-white ring-2 ring-emerald-200",
                    stepStatus === 'em_andamento' && "bg-amber-500 text-white ring-2 ring-amber-200 font-bold",
                    stepStatus === 'na' && "bg-slate-200 border-2 border-slate-300 text-slate-500 font-extrabold text-[10px]",
                    stepStatus === 'pendente' && "bg-white border-2 border-slate-300 text-slate-500 font-semibold text-xs"
                  )}
                >
                  {stepStatus === 'concluido' ? (
                    <Check className="w-4 h-4 text-white stroke-[3]" />
                  ) : stepStatus === 'na' ? (
                    <Ban className="w-4 h-4 text-slate-500" />
                  ) : (
                    stepNum
                  )}
                </div>

                {/* Nome da Etapa */}
                <span className={cn(
                  "text-[11px] font-bold text-center leading-tight mt-0.5",
                  stepStatus === 'concluido' && "text-emerald-700",
                  stepStatus === 'em_andamento' && "text-amber-700",
                  stepStatus === 'na' && "text-slate-500 line-through",
                  stepStatus === 'pendente' && "text-slate-600"
                )}>
                  {phaseObj.nome}
                </span>

                {/* Responsáveis (Suporte a múltiplos responsáveis - Item 4) */}
                <div className="w-full flex flex-col items-center text-[10px] text-slate-500 bg-slate-50/80 px-1.5 py-0.5 rounded-md border border-slate-100 group-hover/step:border-indigo-200 transition-colors">
                  {assign.assignedMembers.length > 0 ? (
                    <div className="flex flex-col items-center gap-0.5">
                      {assign.assignedMembers.map(m => (
                        <span key={m.id} className="flex items-center gap-1 font-semibold text-slate-700 truncate max-w-[110px]">
                          <User className="w-2.5 h-2.5 text-indigo-600 shrink-0" />
                          {m.nome.split(' ')[0]}
                        </span>
                      ))}
                    </div>
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
          <span>{isFase1Concluido ? 'Diagnóstico finalizado com sucesso!' : (pipeFase1?.mensagem_info || 'Diagnóstico pronto para acompanhamento')}</span>
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
            Detalhes & Datas
          </button>
        </div>
      </div>
    </div>
  );
}
