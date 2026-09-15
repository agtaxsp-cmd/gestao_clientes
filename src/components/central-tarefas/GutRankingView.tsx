import React from 'react';
import { CentralTarefa, CentralTarefaStatus } from '../../types';
import { getGutCriticity } from '../../lib/gut';
import { Building2, User, Calendar, Edit2, Trash2, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';

interface GutRankingViewProps {
  tarefas: CentralTarefa[];
  onEdit: (tarefa: CentralTarefa) => void;
  onDelete: (id: string) => void;
  onMoveStatus: (id: string, newStatus: CentralTarefaStatus) => void;
}

const STATUS_LABELS: Record<CentralTarefaStatus, { label: string; badge: string }> = {
  backlog: { label: 'Backlog', badge: 'bg-slate-100 text-slate-700 border-slate-200' },
  todo: { label: 'A Fazer', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  in_progress: { label: 'Em Andamento', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  done: { label: 'Concluído', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
};

export default function GutRankingView({ tarefas, onEdit, onDelete, onMoveStatus }: GutRankingViewProps) {
  // Ordena rigorosamente pelo Score GUT decrescente
  const sorted = [...tarefas].sort((a, b) => (b.gut_score || 0) - (a.gut_score || 0));

  if (sorted.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 text-xs shadow-2xs">
        Nenhuma tarefa encontrada com os filtros selecionados.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
      <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-600" />
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Ranking de Prioridades — Matriz GUT (Gravidade × Urgência × Tendência)
          </h4>
        </div>
        <span className="text-[11px] text-slate-500 font-mono">
          {sorted.length} tarefas ordenadas por criticidade
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100/60 text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
              <th className="px-4 py-3 text-center w-12">#</th>
              <th className="px-4 py-3 text-center">Score GUT</th>
              <th className="px-4 py-3 text-center">G · U · T</th>
              <th className="px-4 py-3">Tarefa</th>
              <th className="px-4 py-3">Empresa Cliente</th>
              <th className="px-4 py-3">Responsável</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Prazo</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((tarefa, idx) => {
              const gut = getGutCriticity(tarefa.gut_score);
              const isCritica = tarefa.gut_score >= 80;
              const statusCfg = STATUS_LABELS[tarefa.status];

              return (
                <tr
                  key={tarefa.id}
                  className={cn(
                    "hover:bg-slate-50/80 transition-colors",
                    isCritica && tarefa.status !== 'done' && "bg-rose-50/20"
                  )}
                >
                  <td className="px-4 py-3.5 text-center font-bold text-slate-400">
                    {idx + 1}
                  </td>

                  {/* Score GUT */}
                  <td className="px-4 py-3.5 text-center">
                    <span className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-black inline-flex items-center gap-1.5 border",
                      gut.badgeBg,
                      gut.badgeText,
                      gut.badgeBorder
                    )}>
                      <span className={cn("w-2 h-2 rounded-full shrink-0", gut.dotColor)} />
                      <span>{tarefa.gut_score}</span>
                      <span className="text-[10px] opacity-70 font-semibold">({gut.label})</span>
                    </span>
                  </td>

                  {/* Detalhe G U T */}
                  <td className="px-4 py-3.5 text-center font-mono text-[11px] text-slate-600 font-bold">
                    {tarefa.gravidade} × {tarefa.urgencia} × {tarefa.tendencia}
                  </td>

                  {/* Título & Descrição */}
                  <td className="px-4 py-3.5 max-w-xs">
                    <span className={cn(
                      "font-bold text-slate-900 block",
                      tarefa.status === 'done' && "line-through text-slate-400"
                    )}>
                      {tarefa.titulo}
                    </span>
                    {tarefa.descricao && (
                      <span className="text-[11px] text-slate-500 line-clamp-1">
                        {tarefa.descricao}
                      </span>
                    )}
                  </td>

                  {/* Cliente */}
                  <td className="px-4 py-3.5 text-slate-700">
                    {tarefa.client ? (
                      <span className="font-semibold flex items-center gap-1.5 truncate" title={tarefa.client.razao_social}>
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{tarefa.client.razao_social}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">Demanda interna</span>
                    )}
                  </td>

                  {/* Responsável */}
                  <td className="px-4 py-3.5">
                    {tarefa.responsavel ? (
                      <div className="flex items-center gap-1.5">
                        <div className={cn(
                          "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0",
                          tarefa.responsavel.ui_color_bg || "bg-indigo-100",
                          tarefa.responsavel.ui_color_text || "text-indigo-800"
                        )}>
                          {tarefa.responsavel.iniciais || tarefa.responsavel.nome.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-[11px] font-medium text-slate-700 truncate">
                          {tarefa.responsavel.nome}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">Não atribuído</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3.5 text-center">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase inline-flex items-center gap-1 border",
                      statusCfg.badge
                    )}>
                      {statusCfg.label}
                    </span>
                  </td>

                  {/* Prazo */}
                  <td className="px-4 py-3.5 text-center font-mono text-slate-600 text-[11px]">
                    {tarefa.data_vencimento ? (
                      <span className="flex items-center justify-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {tarefa.data_vencimento.split('-').reverse().join('/')}
                      </span>
                    ) : (
                      <span className="text-slate-300">--/--/----</span>
                    )}
                  </td>

                  {/* Ações */}
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      {tarefa.status !== 'done' && (
                        <button
                          type="button"
                          onClick={() => onMoveStatus(tarefa.id, 'done')}
                          className="p-1 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                          title="Marcar como Concluído"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onEdit(tarefa)}
                        className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                        title="Editar Tarefa"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('Tem certeza que deseja excluir esta tarefa?')) {
                            onDelete(tarefa.id);
                          }
                        }}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Excluir Tarefa"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
