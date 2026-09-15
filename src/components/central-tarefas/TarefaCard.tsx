import React, { useState } from 'react';
import { CentralTarefa, CentralTarefaStatus } from '../../types';
import { getGutCriticity } from '../../lib/gut';
import { Calendar, Building2, User, MoreVertical, Edit2, Trash2, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface TarefaCardProps {
  key?: React.Key;
  tarefa: CentralTarefa;
  onEdit: (tarefa: CentralTarefa) => void;
  onDelete: (id: string) => void;
  onMoveStatus: (id: string, newStatus: CentralTarefaStatus) => void;
}

export default function TarefaCard({ tarefa, onEdit, onDelete, onMoveStatus }: TarefaCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const gut = getGutCriticity(tarefa.gut_score);
  const isCritica = tarefa.gut_score >= 80;

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    e.dataTransfer.setData('text/plain', tarefa.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // Status mapping para mover rapidamente
  const nextStatusMap: Record<CentralTarefaStatus, { label: string; next: CentralTarefaStatus } | null> = {
    backlog: { label: 'Mover para A Fazer', next: 'todo' },
    todo: { label: 'Iniciar Tarefa', next: 'in_progress' },
    in_progress: { label: 'Enviar para Revisão', next: 'in_review' },
    in_review: { label: 'Concluir Tarefa', next: 'done' },
    done: null
  };

  const nextAction = nextStatusMap[tarefa.status];

  // Formatar data de vencimento
  const formatDueDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const due = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isOverdue = due < today && tarefa.status !== 'done';
      return {
        formatted: `${parts[2]}/${parts[1]}/${parts[0]}`,
        isOverdue
      };
    }
    return { formatted: dateStr, isOverdue: false };
  };

  const dueInfo = formatDueDate(tarefa.data_vencimento);

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={cn(
        "group relative bg-white rounded-2xl border p-4 shadow-2xs hover:shadow-md transition-all cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40 scale-95 ring-2 ring-indigo-500",
        isCritica ? "border-rose-300 hover:border-rose-400" : "border-slate-200 hover:border-slate-300"
      )}
    >
      {/* Alerta de criticidade superior (se >= 80) integrado no card para nunca cortar */}
      {isCritica && tarefa.status !== 'done' && (
        <div className="mb-2.5 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-black uppercase tracking-wider flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
            <span>Criticidade Máxima</span>
          </div>
          <span className="text-[9px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded">GUT {tarefa.gut_score}</span>
        </div>
      )}

      {/* Header do Card: Badges */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        {/* Badge GUT */}
        <div
          title={`G: ${tarefa.gravidade} | U: ${tarefa.urgencia} | T: ${tarefa.tendencia} = ${tarefa.gut_score}`}
          className={cn(
            "px-2.5 py-1 rounded-lg border text-[11px] font-black flex items-center gap-1.5 transition-transform group-hover:scale-105",
            gut.badgeBg,
            gut.badgeText,
            gut.badgeBorder
          )}
        >
          <span className={cn("w-1.5 h-1.5 rounded-full", gut.dotColor)} />
          <span>GUT {tarefa.gut_score}</span>
          <span className="opacity-70 font-semibold text-[10px]">· {gut.label}</span>
        </div>

        {/* Menu de Ações */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Opções"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-6 z-50 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1 text-xs text-slate-700">
                {nextAction && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onMoveStatus(tarefa.id, nextAction.next);
                    }}
                    className="w-full px-3 py-2 text-left font-semibold text-indigo-600 hover:bg-indigo-50 flex items-center gap-2 cursor-pointer"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>{nextAction.label}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onEdit(tarefa);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Editar Tarefa</span>
                </button>

                <div className="border-t border-slate-100 my-1" />

                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    if (confirm('Tem certeza que deseja excluir esta tarefa?')) {
                      onDelete(tarefa.id);
                    }
                  }}
                  className="w-full px-3 py-2 text-left text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer font-medium"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  <span>Excluir</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Título */}
      <h4 className={cn(
        "text-xs font-bold text-slate-900 leading-snug mb-1.5",
        tarefa.status === 'done' && "line-through text-slate-400"
      )}>
        {tarefa.titulo}
      </h4>

      {/* Descrição - sem cortar prematuramente, com quebra de linha suave */}
      {tarefa.descricao && (
        <p
          className="text-[11px] text-slate-600 leading-relaxed mb-3 break-words line-clamp-4"
          title={tarefa.descricao}
        >
          {tarefa.descricao}
        </p>
      )}

      {/* Tags de Contexto (Cliente e Prazo) */}
      <div className="space-y-1.5 pt-2 border-t border-slate-100/80 mb-3">
        {/* Cliente */}
        {tarefa.client ? (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 truncate" title={tarefa.client.razao_social}>
            <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="font-semibold truncate">{tarefa.client.razao_social}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 italic">
            <Building2 className="w-3 h-3 shrink-0" />
            <span>Sem empresa vinculada</span>
          </div>
        )}

        {/* Data de Vencimento */}
        {dueInfo && (
          <div className={cn(
            "flex items-center gap-1.5 text-[10px] font-mono",
            dueInfo.isOverdue ? "text-rose-600 font-bold" : "text-slate-500 font-medium"
          )}>
            <Calendar className="w-3 h-3 shrink-0" />
            <span>Prazo: {dueInfo.formatted}</span>
            {dueInfo.isOverdue && (
              <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 text-[9px] font-black uppercase">
                Atrasada
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer: Responsáveis (Execução & Revisão) e Detalhes GUT */}
      <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-100 text-[11px]">
        <div className="flex items-center justify-between gap-2 min-w-0 flex-wrap">
          {/* Responsável Execução */}
          <div className="flex items-center gap-1.5 min-w-0" title={`Responsável Execução: ${tarefa.responsavel?.nome || 'Não atribuído'}`}>
            {tarefa.responsavel ? (
              <>
                <div className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 transition-opacity",
                  tarefa.status === 'in_review' ? "bg-slate-200 text-slate-500 opacity-60" : (tarefa.responsavel.ui_color_bg || "bg-indigo-100"),
                  tarefa.status === 'in_review' ? "" : (tarefa.responsavel.ui_color_text || "text-indigo-800")
                )}>
                  {tarefa.responsavel.iniciais || tarefa.responsavel.nome.slice(0, 2).toUpperCase()}
                </div>
                <span className={cn(
                  "text-[11px] truncate",
                  tarefa.status === 'in_review' ? "line-through text-slate-400 font-normal opacity-70" : "font-medium text-slate-700"
                )}>
                  {tarefa.responsavel.nome}
                </span>
              </>
            ) : (
              <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                <User className="w-3.5 h-3.5" />
                <span>Sem Executor</span>
              </div>
            )}
          </div>

          {/* Indicador de Notas G·U·T */}
          <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
            G{tarefa.gravidade}·U{tarefa.urgencia}·T{tarefa.tendencia}
          </span>
        </div>

        {/* Responsável Revisão */}
        {tarefa.responsavel_revisao ? (
          <div className="flex items-center gap-1.5 min-w-0 pt-0.5" title={`Responsável Revisão: ${tarefa.responsavel_revisao.nome}`}>
            <div className={cn(
              "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0",
              tarefa.status === 'in_review' ? "bg-purple-600 text-white shadow-xs" : (tarefa.responsavel_revisao.ui_color_bg || "bg-purple-100"),
              tarefa.status === 'in_review' ? "" : (tarefa.responsavel_revisao.ui_color_text || "text-purple-800")
            )}>
              {tarefa.responsavel_revisao.iniciais || tarefa.responsavel_revisao.nome.slice(0, 2).toUpperCase()}
            </div>
            <div className={cn(
              "flex items-center gap-1 min-w-0 text-[11px]",
              tarefa.status === 'in_review' ? "font-bold text-purple-900 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200/80" : "text-slate-600 font-medium"
            )}>
              <span className="text-[9px] uppercase tracking-wider text-purple-600 font-black">Rev:</span>
              <span className="truncate">{tarefa.responsavel_revisao.nome}</span>
            </div>
          </div>
        ) : (
          tarefa.status === 'in_review' && (
            <div className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50/90 px-2 py-0.5 rounded-lg border border-amber-200 font-semibold">
              <User className="w-3 h-3 text-amber-500 shrink-0" />
              <span>Sem revisor atribuído</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
