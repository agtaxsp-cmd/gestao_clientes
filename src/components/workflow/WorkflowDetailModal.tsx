import React from 'react';
import { X, Folder, Save, User, UserCheck, FileText, Loader2 } from 'lucide-react';
import { Client, WorkflowPipeline, WorkflowPhase, TeamMember, FaseGrupoEnum } from '../../types';
import { MESES } from './types';
import { cn } from '../../lib/utils';

export interface WorkflowDetailModalProps {
  client: Client;
  grupo: FaseGrupoEnum;
  stepNum: number;
  month: number | null;
  pipe: WorkflowPipeline | null;
  fasesDiagnostico: WorkflowPhase[];
  fasesPlanoAcao: WorkflowPhase[];
  fasesGovernanca: WorkflowPhase[];
  members: TeamMember[];
  path: string;
  notes: string;
  principalId: string;
  backupId: string;
  saving: boolean;
  onClose: () => void;
  onSwitchStep: (stepNum: number) => void;
  onPathChange: (path: string) => void;
  onNotesChange: (notes: string) => void;
  onPrincipalChange: (id: string) => void;
  onBackupChange: (id: string) => void;
  onSave: () => void;
}

export default function WorkflowDetailModal({
  client,
  grupo,
  stepNum,
  month,
  fasesDiagnostico,
  fasesPlanoAcao,
  members,
  path,
  notes,
  principalId,
  backupId,
  saving,
  onClose,
  onSwitchStep,
  onPathChange,
  onNotesChange,
  onPrincipalChange,
  onBackupChange,
  onSave
}: WorkflowDetailModalProps) {
  const monthObj = MESES.find(m => m.id === month);

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-xl border border-slate-200 relative flex flex-col gap-5">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center gap-2">
            <span className={cn(
              "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase",
              grupo === 'fase_1' ? "bg-indigo-100 text-indigo-700" :
              grupo === 'fase_2' ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
            )}>
              {grupo === 'fase_1' ? 'Fase 1 — Diagnóstico' :
               grupo === 'fase_2' ? `Fase 2 — Plano de Ação (${monthObj?.nome || ''})` :
               `Fase 3 — Governança (${monthObj?.nome || ''})`}
            </span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mt-1">
            {client.razao_social}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure os responsáveis específicos, pastas de rede e observações para esta etapa.
          </p>
        </div>

        {/* Abas para alternar entre etapas (no caso da Fase 1 ou Fase 2) */}
        {grupo === 'fase_1' && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 scrollbar-thin">
            {fasesDiagnostico.map((p, idx) => {
              const sNum = idx + 1;
              const isSelected = stepNum === sNum;
              return (
                <button
                  key={p.id || p.key}
                  type="button"
                  onClick={() => onSwitchStep(sNum)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border",
                    isSelected
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  )}
                >
                  <span>{sNum}. {p.nome}</span>
                </button>
              );
            })}
          </div>
        )}

        {grupo === 'fase_2' && (
          <div className="flex gap-1.5 pb-1 border-b border-slate-200">
            {fasesPlanoAcao.map((p, idx) => {
              const sNum = idx + 1;
              const isSelected = stepNum === sNum;
              return (
                <button
                  key={p.id || p.key}
                  type="button"
                  onClick={() => onSwitchStep(sNum)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border",
                    isSelected
                      ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  )}
                >
                  <span>{sNum}. {p.nome}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex flex-col gap-4">
          {/* Responsáveis */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
                <User className="w-3.5 h-3.5 text-indigo-600" />
                Responsável Principal
              </label>
              <select
                value={principalId}
                onChange={(e) => onPrincipalChange(e.target.value)}
                className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-100 outline-none cursor-pointer"
              >
                <option value="">-- Padrão das Configurações --</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome} ({m.cargo})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
                <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                Responsável Backup
              </label>
              <select
                value={backupId}
                onChange={(e) => onBackupChange(e.target.value)}
                className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-100 outline-none cursor-pointer"
              >
                <option value="">-- Nenhum Backup --</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome} ({m.cargo})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Caminho da Rede */}
          <div>
            <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5 mb-1">
              <Folder className="w-4 h-4 text-indigo-600" />
              Caminho da Rede (Pasta do Servidor)
            </label>
            <div className="flex items-center gap-2">
              <input 
                type="text"
                value={path}
                onChange={(e) => onPathChange(e.target.value)}
                placeholder="Ex: \\servidor\fiscal\empresa\diagnostico"
                className="flex-1 h-10 px-3 border border-slate-200 rounded-lg text-xs font-mono bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none"
              />
              {path && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(path);
                    alert('Caminho copiado!');
                  }}
                  className="px-3 py-2 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 rounded-lg text-xs font-medium transition-colors border border-slate-200 shrink-0 cursor-pointer"
                >
                  Copiar
                </button>
              )}
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5 mb-1">
              <FileText className="w-4 h-4 text-indigo-600" />
              Instruções Livres / Notas de Acompanhamento
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="Digite aqui anotações, links úteis, lembretes de auditoria ou pendências..."
              className="w-full p-3 border border-slate-200 rounded-lg text-xs text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-700 text-white rounded-lg text-xs font-semibold hover:bg-indigo-800 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  );
}
