import React, { useState, useEffect } from 'react';
import { Calendar, Clock, ArrowRight } from 'lucide-react';
import { Client, WorkflowPipeline, WorkflowPhase, normalizeStepStatus, STEP_STATUS_MAP } from '../../types';
import { cn } from '../../lib/utils';

export interface CompanyScheduleTabProps {
  client: Client;
  selectedYear?: number;
  pipeFase1?: WorkflowPipeline;
  fasesDiagnostico: WorkflowPhase[];
  onOpenDetail: (stepNum: number) => void;
  onUpdateMilestoneDate?: (type: 'as_is' | 'to_be', dateVal: string) => void;
}

interface MilestoneDateInputProps {
  label: string;
  value?: string | null;
  selectedYear: number;
  theme: 'indigo' | 'purple';
  onChange: (val: string) => void;
}

function MilestoneDateInput({ label, value, selectedYear, theme, onChange }: MilestoneDateInputProps) {
  const normalizeDate = (val?: string | null): string => {
    if (!val) return '';
    const parts = val.split('-');
    if (parts.length === 3) {
      const y = Number(parts[0]);
      // Se o ano for inválido (< 1900), ajusta para o selectedYear
      if (isNaN(y) || y < 1900) {
        return `${selectedYear}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
      // Se já possui um ano válido (ex: 2026), MANTÉM intacto!
      return val;
    }
    return val;
  };

  const [localVal, setLocalVal] = useState<string>(() => normalizeDate(value));

  useEffect(() => {
    setLocalVal(normalizeDate(value));
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setLocalVal(newVal);

    if (!newVal) {
      onChange('');
      return;
    }

    const parts = newVal.split('-');
    if (parts.length === 3) {
      const y = Number(parts[0]);
      // Aceita qualquer ano de 4 dígitos válido (>= 1900)
      if (parts[0].length === 4 && y >= 1900) {
        onChange(newVal);
      }
    }
  };

  const handleBlur = () => {
    if (!localVal) {
      if (value) onChange('');
      return;
    }
    const parts = localVal.split('-');
    if (parts.length === 3) {
      const y = Number(parts[0]);
      if (parts[0].length === 4 && y >= 1900) {
        if (localVal !== value) {
          onChange(localVal);
        }
      } else if (y < 1900) {
        const clean = `${selectedYear}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        setLocalVal(clean);
        if (clean !== value) {
          onChange(clean);
        }
      }
    }
  };

  const isIndigo = theme === 'indigo';

  return (
    <div className={cn(
      "p-4 rounded-2xl border flex items-center justify-between shadow-2xs",
      isIndigo
        ? "bg-gradient-to-br from-indigo-50/80 to-white border-indigo-100"
        : "bg-gradient-to-br from-purple-50/80 to-white border-purple-100"
    )}>
      <div className="flex items-center gap-3 w-full">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0",
          isIndigo ? "bg-indigo-100 text-indigo-700" : "bg-purple-100 text-purple-700"
        )}>
          <Calendar className="w-5 h-5" />
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block truncate">
              {label}
            </label>
            {localVal && (
              <button
                type="button"
                onClick={() => {
                  setLocalVal('');
                  onChange('');
                }}
                className="text-[10px] text-slate-400 hover:text-rose-600 transition-colors font-semibold"
                title="Limpar data"
              >
                Limpar
              </button>
            )}
          </div>
          <input
            type="date"
            value={localVal}
            onChange={handleInputChange}
            onBlur={handleBlur}
            className={cn(
              "text-xs font-bold bg-white border rounded-lg px-2 py-1 mt-1 outline-none cursor-pointer w-full max-w-[150px]",
              isIndigo
                ? "text-indigo-950 border-indigo-200 focus:ring-2 focus:ring-indigo-300"
                : "text-purple-950 border-purple-200 focus:ring-2 focus:ring-purple-300"
            )}
          />
        </div>
      </div>
    </div>
  );
}

export default function CompanyScheduleTab({
  client,
  selectedYear = new Date().getFullYear(),
  pipeFase1,
  fasesDiagnostico,
  onOpenDetail,
  onUpdateMilestoneDate
}: CompanyScheduleTabProps) {
  const datasEtapas = pipeFase1?.datas_etapas || {};
  const statusEtapas = pipeFase1?.status_etapas || {};

  const startAsIs = pipeFase1?.start_as_is || datasEtapas['5']?.data_inicio || datasEtapas['5']?.data_fim;
  const startToBe = pipeFase1?.start_to_be || datasEtapas['7']?.data_inicio || datasEtapas['7']?.data_fim;

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
    const [y1, m1, d1] = start.split('-').map(Number);
    const [y2, m2, d2] = end.split('-').map(Number);
    if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return null;
    const dt1 = new Date(y1, m1 - 1, d1);
    const dt2 = new Date(y2, m2 - 1, d2);
    const diffTime = Math.abs(dt2.getTime() - dt1.getTime());
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  };

  // Calcular total de dias do projeto (desconsiderando outorgas)
  let totalDiasProjeto = 0;

  fasesDiagnostico.forEach((phaseObj, idx) => {
    const stepNum = idx + 1;
    const isOutorga = Boolean(phaseObj.key?.startsWith('outorga') || phaseObj.nome?.toLowerCase().includes('outorga') || phaseObj.key?.toLowerCase().includes('outorga'));
    if (isOutorga) return;

    const dates = datasEtapas[String(stepNum)] || (
      stepNum === 5 && startAsIs ? { data_inicio: startAsIs, data_fim: null } :
      stepNum === 7 && startToBe ? { data_inicio: startToBe, data_fim: null } :
      undefined
    );
    if (dates?.data_inicio && dates?.data_fim) {
      const days = calculateDays(dates.data_inicio, dates.data_fim);
      if (days !== null) {
        totalDiasProjeto += days;
      }
    }
  });

  return (
    <div className="flex flex-col gap-6">
      {/* ──────── Header dos Marcos Principais (Apresentação AS-IS & Apresentação TO-BE) ──────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card Apresentação AS-IS */}
        <MilestoneDateInput
          label="Apresentação AS-IS"
          value={startAsIs}
          selectedYear={selectedYear}
          theme="indigo"
          onChange={(val) => onUpdateMilestoneDate && onUpdateMilestoneDate('as_is', val)}
        />

        {/* Card Apresentação TO-BE */}
        <MilestoneDateInput
          label="Apresentação TO-BE"
          value={startToBe}
          selectedYear={selectedYear}
          theme="purple"
          onChange={(val) => onUpdateMilestoneDate && onUpdateMilestoneDate('to_be', val)}
        />

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
                const isOutorga = Boolean(phaseObj.key?.startsWith('outorga') || phaseObj.nome?.toLowerCase().includes('outorga') || phaseObj.key?.toLowerCase().includes('outorga'));
                const dates = datasEtapas[stepKey] || (
                  stepNum === 5 && startAsIs ? { data_inicio: startAsIs, data_fim: null } :
                  stepNum === 7 && startToBe ? { data_inicio: startToBe, data_fim: null } :
                  undefined
                );
                const rawSt = statusEtapas[stepKey];
                const normSt = rawSt ? normalizeStepStatus(rawSt) : null;
                const f1StepNum = pipeFase1?.etapa_atual || 1;
                const isFase1Concluido = pipeFase1?.status === 'concluido';
                const hasDates = Boolean(dates?.data_inicio || dates?.data_fim);

                const stStatus = normSt === 'na'
                  ? 'na'
                  : (normSt === 'concluido' || stepNum < f1StepNum || isFase1Concluido || (isOutorga && hasDates)
                      ? 'concluido'
                      : (normSt || (stepNum === f1StepNum ? 'em_andamento' : 'pendente'))
                    );

                const stMeta = STEP_STATUS_MAP[stStatus];
                const days = isOutorga ? null : calculateDays(dates?.data_inicio, dates?.data_fim);

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
                      {isOutorga ? '-' : (days !== null ? `${days} dias` : '-')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase inline-flex items-center gap-1 border",
                        stMeta?.badgeBg,
                        stMeta?.badgeText,
                        stMeta?.badgeBorder
                      )}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", stMeta?.dotBg)} />
                        {stMeta?.label || stStatus}
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
