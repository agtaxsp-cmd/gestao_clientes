import React, { useState } from 'react';
import { Compass, FileCheck, ShieldCheck, Eye, Calendar, Ban } from 'lucide-react';
import { Client, WorkflowPipeline, WorkflowPhase, TeamMember, WorkflowAssignment, FaseGrupoEnum, FaseTabEnum, REGIMES_CONFIG, getRegimeFromSegmento, RegimeEnum, EtapaColorStatus } from '../../types';
import Phase1Stepper from './Phase1Stepper';
import MonthRoulette from './MonthRoulette';
import CompanyScheduleTab from './CompanyScheduleTab';
import { MESES } from './types';
import { cn, formatCNPJ, formatCNAE } from '../../lib/utils';

export interface CompanyWorkflowCardProps {
  key?: React.Key;
  client: Client;
  selectedYear: number;
  pipelines: WorkflowPipeline[];
  fasesDiagnostico: WorkflowPhase[];
  fasesPlanoAcao: WorkflowPhase[];
  fasesGovernanca: WorkflowPhase[];
  members: TeamMember[];
  assignments: WorkflowAssignment[];
  onAdvanceFase1: (client: Client, currentPipe?: WorkflowPipeline) => void;
  onRegressFase1: (client: Client, pipe: WorkflowPipeline) => void;
  onAdvanceMonthly: (client: Client, grupo: 'fase_2' | 'fase_3', month: number, year: number) => void;
  onOpenDetail: (client: Client, grupo: FaseGrupoEnum, stepNum: number, month?: number | null) => void;
  onOpenAnalytic: (client: Client) => void;
  onTogglePhaseDisabled?: (client: Client, grupo: 'fase_2' | 'fase_3', disabled: boolean) => void;
  onUpdateStepStatus?: (client: Client, stepNum: number, newStatus: EtapaColorStatus) => void;
  onSavePeriodoEscopo?: (client: Client, periodo: string) => void;
}

export default function CompanyWorkflowCard({
  client,
  selectedYear,
  pipelines,
  fasesDiagnostico,
  fasesPlanoAcao,
  fasesGovernanca,
  members,
  assignments,
  onAdvanceFase1,
  onRegressFase1,
  onAdvanceMonthly,
  onOpenDetail,
  onOpenAnalytic,
  onTogglePhaseDisabled,
  onUpdateStepStatus,
  onSavePeriodoEscopo
}: CompanyWorkflowCardProps) {
  const [activeTab, setActiveTab] = useState<FaseTabEnum>('fase_1');

  const getInitials = (name?: string) => {
    if (!name) return 'CL';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  // Pipeline Fase 1
  const pipeFase1 = pipelines.find(p => p.client_id === client.id && p.fase_grupo === 'fase_1');
  const isFase1Concluido = pipeFase1?.status === 'concluido';
  const f1StepNum = pipeFase1?.etapa_atual || 1;

  // Status das etapas (contagem verde)
  const statusEtapas = pipeFase1?.status_etapas || {};
  const greenCount = Object.values(statusEtapas).filter(s => s === 'verde').length;

  // Fases Desabilitadas (Não Aplicáveis)
  const fasesDesabilitadas = pipeFase1?.fases_desabilitadas || {};
  const isFase1Disabled = !!fasesDesabilitadas['fase_1'];
  const isFase2Disabled = !!fasesDesabilitadas['fase_2'];
  const isFase3Disabled = !!fasesDesabilitadas['fase_3'];

  // Estatísticas Fase 2 do cliente
  const f2MonthsConcluidos = MESES.filter(m => {
    const p = pipelines.find(
      pipe => pipe.client_id === client.id &&
              pipe.fase_grupo === 'fase_2' &&
              pipe.ano_referencia === selectedYear &&
              pipe.mes_referencia === m.id
    );
    return p?.status === 'concluido';
  }).length;

  // Estatísticas Fase 3 do cliente
  const f3MonthsConcluidos = MESES.filter(m => {
    const p = pipelines.find(
      pipe => pipe.client_id === client.id &&
              pipe.fase_grupo === 'fase_3' &&
              pipe.ano_referencia === selectedYear &&
              pipe.mes_referencia === m.id
    );
    return p?.status === 'concluido';
  }).length;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col transition-all hover:shadow-md">
      {/* ──────── Cabeçalho do Card da Empresa ──────── */}
      <div className="p-5 bg-gradient-to-r from-slate-50/90 via-white to-slate-50/50 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Identificação */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center font-bold text-indigo-700 text-base shadow-2xs border border-indigo-200/60 shrink-0">
            {getInitials(client.razao_social)}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-900">{client.razao_social}</h3>
              {client.nome_grupo && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-700 border border-purple-200">
                  Grupo: {client.nome_grupo}
                </span>
              )}
              {(() => {
                const regimeKey = (client.regime || getRegimeFromSegmento(client.segmento)) as RegimeEnum;
                const regConf = REGIMES_CONFIG[regimeKey] || REGIMES_CONFIG.regular;
                return (
                  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border", regConf.badgeBg, regConf.badgeText, regConf.badgeBorder)}>
                    {regConf.shortLabel}
                  </span>
                );
              })()}
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200" title={client.segmento}>
                {client.segmento}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              CNPJ: {formatCNPJ(client.cnpj) || '-'} {client.cnae_principal ? `• CNAE: ${formatCNAE(client.cnae_principal)}` : ''}
            </p>
          </div>
        </div>

        {/* Resumos rápidos das 3 Fases + Botão Analítico */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Indicador Fase 1 */}
          <div className={cn(
            "px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5",
            isFase1Concluido 
              ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
              : "bg-indigo-50 text-indigo-700 border-indigo-200"
          )}>
            <Compass className="w-3.5 h-3.5" />
            <span>F1: {isFase1Concluido ? 'Diagnóstico Concluído' : `${greenCount}/7 Concluídos`}</span>
          </div>

          {/* Indicador Fase 2 */}
          <div className={cn(
            "px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5",
            isFase2Disabled ? "bg-slate-100 text-slate-400 border-slate-200 line-through" : "bg-blue-50 text-blue-700 border-blue-200"
          )}>
            <FileCheck className="w-3.5 h-3.5" />
            <span>F2: {isFase2Disabled ? 'N/A Não Contratado' : `${f2MonthsConcluidos}/12 Meses (${selectedYear})`}</span>
          </div>

          {/* Indicador Fase 3 */}
          <div className={cn(
            "px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5",
            isFase3Disabled ? "bg-slate-100 text-slate-400 border-slate-200 line-through" : "bg-emerald-50 text-emerald-700 border-emerald-200"
          )}>
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>F3: {isFase3Disabled ? 'N/A Não Contratado' : `${f3MonthsConcluidos}/12 Auditados (${selectedYear})`}</span>
          </div>

          {/* Botão Visão Analítica Completa */}
          <button
            onClick={() => onOpenAnalytic(client)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 hover:border-indigo-200 transition-all cursor-pointer shadow-2xs"
          >
            <Eye className="w-3.5 h-3.5" />
            Visão Completa
          </button>
        </div>
      </div>

      {/* ──────── Seletor de Fases Internas (Abas) ──────── */}
      <div className="flex border-b border-slate-200 bg-slate-50/60 px-5 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('fase_1')}
          className={cn(
            "py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer",
            isFase1Disabled && "opacity-60 line-through",
            activeTab === 'fase_1'
              ? "border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-2xs"
              : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          <Compass className="w-4 h-4 text-indigo-600" />
          <span>FASE 1 — DIAGNÓSTICO</span>
          {isFase1Disabled ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600">N/A</span>
          ) : (
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-bold",
              isFase1Concluido ? "bg-emerald-100 text-emerald-700" : "bg-indigo-100 text-indigo-700"
            )}>
              {isFase1Concluido ? 'Concluído' : `${greenCount}/${fasesDiagnostico.length || 7}`}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('fase_2')}
          className={cn(
            "py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer",
            isFase2Disabled && "opacity-60 line-through",
            activeTab === 'fase_2'
              ? "border-blue-600 text-blue-700 bg-white rounded-t-lg shadow-2xs"
              : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          <FileCheck className="w-4 h-4 text-blue-600" />
          <span>FASE 2 — PLANO DE AÇÃO ({selectedYear})</span>
          {isFase2Disabled ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600">N/A</span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
              {f2MonthsConcluidos}/12 Meses
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('fase_3')}
          className={cn(
            "py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer",
            isFase3Disabled && "opacity-60 line-through",
            activeTab === 'fase_3'
              ? "border-emerald-600 text-emerald-700 bg-white rounded-t-lg shadow-2xs"
              : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>FASE 3 — GOVERNANÇA ({selectedYear})</span>
          {isFase3Disabled ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600">N/A</span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
              {f3MonthsConcluidos}/12 Meses
            </span>
          )}
        </button>

        {/* 4ª Aba: CRONOGRAMA */}
        <button
          onClick={() => setActiveTab('cronograma')}
          className={cn(
            "py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer",
            activeTab === 'cronograma'
              ? "border-purple-600 text-purple-700 bg-white rounded-t-lg shadow-2xs"
              : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          <Calendar className="w-4 h-4 text-purple-600" />
          <span>CRONOGRAMA</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">
            Fase 1
          </span>
        </button>
      </div>

      {/* ──────── Conteúdo da Fase Ativa ──────── */}
      <div className="p-5">
        {/* FASE 1: DIAGNÓSTICO */}
        {activeTab === 'fase_1' && (
          isFase1Disabled ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-500 text-xs">
              Esta fase (Fase 1 — Diagnóstico) foi marcada como <strong>Não Aplicável (Não Contratada)</strong> para este cliente.
            </div>
          ) : (
            <Phase1Stepper
              client={client}
              pipeFase1={pipeFase1}
              fasesDiagnostico={fasesDiagnostico}
              members={members}
              assignments={assignments}
              onAdvance={onAdvanceFase1}
              onRegress={onRegressFase1}
              onOpenDetail={(c, g, s) => onOpenDetail(c, g, s, null)}
              onUpdateStepStatus={onUpdateStepStatus ? (stepNum, st) => onUpdateStepStatus(client, stepNum, st) : undefined}
              onSavePeriodoEscopo={onSavePeriodoEscopo ? (p) => onSavePeriodoEscopo(client, p) : undefined}
            />
          )
        )}

        {/* FASE 2: PLANO DE AÇÃO */}
        {activeTab === 'fase_2' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                <span>Fluxo mensal com 2 etapas por mês (<strong>ELABORAR</strong> e <strong>ACOMPANHAMENTO</strong>) no ano {selectedYear}</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onTogglePhaseDisabled && onTogglePhaseDisabled(client, 'fase_2', !isFase2Disabled)}
                  className={cn(
                    "px-3 py-1 rounded-lg font-bold text-[11px] transition-colors flex items-center gap-1 cursor-pointer",
                    isFase2Disabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  )}
                >
                  <Ban className="w-3.5 h-3.5" />
                  {isFase2Disabled ? 'Habilitar Fase 2' : 'Marcar como Não Aplicável (N/A)'}
                </button>
                <span className="font-semibold text-blue-700">
                  {f2MonthsConcluidos} de 12 meses concluídos
                </span>
              </div>
            </div>

            {isFase2Disabled ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-500 text-xs">
                Esta fase foi marcada como <strong>Não Aplicável (Não Contratada)</strong> para este cliente.
              </div>
            ) : (
              <MonthRoulette
                client={client}
                grupo="fase_2"
                selectedYear={selectedYear}
                pipelines={pipelines}
                fasesPlanoAcao={fasesPlanoAcao}
                fasesGovernanca={fasesGovernanca}
                onAdvance={onAdvanceMonthly}
                onOpenDetail={(c, g, s, m) => onOpenDetail(c, g, s, m)}
              />
            )}
          </div>
        )}

        {/* FASE 3: GOVERNANÇA */}
        {activeTab === 'fase_3' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                <span>
                  Fluxo mensal de governança ({fasesGovernanca.length || 1} etapas: <strong>{fasesGovernanca.map(f => f.nome).join(' ➔ ') || 'AUDITORIA'}</strong>) no ano {selectedYear}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onTogglePhaseDisabled && onTogglePhaseDisabled(client, 'fase_3', !isFase3Disabled)}
                  className={cn(
                    "px-3 py-1 rounded-lg font-bold text-[11px] transition-colors flex items-center gap-1 cursor-pointer",
                    isFase3Disabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  )}
                >
                  <Ban className="w-3.5 h-3.5" />
                  {isFase3Disabled ? 'Habilitar Fase 3' : 'Marcar como Não Aplicável (N/A)'}
                </button>
                <span className="font-semibold text-emerald-700">
                  {f3MonthsConcluidos} de 12 auditorias concluídas
                </span>
              </div>
            </div>

            {isFase3Disabled ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-500 text-xs">
                Esta fase foi marcada como <strong>Não Aplicável (Não Contratada)</strong> para este cliente.
              </div>
            ) : (
              <MonthRoulette
                client={client}
                grupo="fase_3"
                selectedYear={selectedYear}
                pipelines={pipelines}
                fasesPlanoAcao={fasesPlanoAcao}
                fasesGovernanca={fasesGovernanca}
                onAdvance={onAdvanceMonthly}
                onOpenDetail={(c, g, s, m) => onOpenDetail(c, g, s, m)}
              />
            )}
          </div>
        )}

        {/* 4ª ABA: CRONOGRAMA */}
        {activeTab === 'cronograma' && (
          <CompanyScheduleTab
            client={client}
            pipeFase1={pipeFase1}
            fasesDiagnostico={fasesDiagnostico}
            onOpenDetail={(stepNum) => onOpenDetail(client, 'fase_1', stepNum, null)}
          />
        )}
      </div>
    </div>
  );
}
