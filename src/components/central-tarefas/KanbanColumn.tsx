import React, { useState } from 'react';
import { CentralTarefa, CentralTarefaStatus } from '../../types';
import TarefaCard from './TarefaCard';
import { Plus, Inbox, Clock, PlayCircle, FileCheck, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface KanbanColumnProps {
  status: CentralTarefaStatus;
  title: string;
  tarefas: CentralTarefa[];
  onMoveStatus: (id: string, newStatus: CentralTarefaStatus) => void;
  onEdit: (tarefa: CentralTarefa) => void;
  onDelete: (id: string) => void;
  onAddNew: (status: CentralTarefaStatus) => void;
}

const COLUMN_CONFIG: Record<CentralTarefaStatus, {
  color: string;
  headerBg: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  icon: typeof Inbox;
}> = {
  backlog: {
    color: 'text-slate-700',
    headerBg: 'bg-slate-100/70',
    badgeBg: 'bg-slate-200',
    badgeText: 'text-slate-800',
    borderColor: 'border-slate-200',
    icon: Inbox
  },
  todo: {
    color: 'text-indigo-700',
    headerBg: 'bg-indigo-50/70',
    badgeBg: 'bg-indigo-100',
    badgeText: 'text-indigo-800',
    borderColor: 'border-indigo-100',
    icon: Clock
  },
  in_progress: {
    color: 'text-amber-700',
    headerBg: 'bg-amber-50/70',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-800',
    borderColor: 'border-amber-100',
    icon: PlayCircle
  },
  in_review: {
    color: 'text-purple-700',
    headerBg: 'bg-purple-50/70',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-800',
    borderColor: 'border-purple-100',
    icon: FileCheck
  },
  done: {
    color: 'text-emerald-700',
    headerBg: 'bg-emerald-50/70',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
    borderColor: 'border-emerald-100',
    icon: CheckCircle2
  }
};

export default function KanbanColumn({
  status,
  title,
  tarefas,
  onMoveStatus,
  onEdit,
  onDelete,
  onAddNew
}: KanbanColumnProps) {
  const [isOver, setIsOver] = useState(false);
  const cfg = COLUMN_CONFIG[status];
  const Icon = cfg.icon;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isOver) setIsOver(true);
  };

  const handleDragLeave = () => {
    setIsOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);
    const id = e.dataTransfer.getData('text/plain');
    if (id) {
      onMoveStatus(id, status);
    }
  };

  // Contar tarefas críticas nesta coluna
  const criticasCount = tarefas.filter(t => t.gut_score >= 80).length;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "flex flex-col bg-slate-100/70 rounded-2xl border p-3 min-w-[280px] w-full transition-colors duration-200",
        isOver ? "bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-400/40" : cfg.borderColor
      )}
    >
      {/* Header da Coluna */}
      <div className={cn(
        "px-3 py-2.5 rounded-xl flex items-center justify-between mb-3 border",
        cfg.headerBg,
        cfg.borderColor
      )}>
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className={cn("w-4 h-4 shrink-0", cfg.color)} />
          <h3 className={cn("text-xs font-black uppercase tracking-wider whitespace-nowrap truncate", cfg.color)}>
            {title}
          </h3>
          <span className={cn(
            "px-2 py-0.5 rounded-full text-[10px] font-black shrink-0",
            cfg.badgeBg,
            cfg.badgeText
          )}>
            {tarefas.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {criticasCount > 0 && status !== 'done' && (
            <span
              title={`${criticasCount} tarefa(s) com GUT >= 80`}
              className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-black uppercase tracking-wider"
            >
              {criticasCount} crítica{criticasCount > 1 ? 's' : ''}
            </span>
          )}

          <button
            type="button"
            onClick={() => onAddNew(status)}
            className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-white/80 rounded-lg transition-colors cursor-pointer"
            title={`Adicionar tarefa em ${title}`}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Lista de Cards da Coluna */}
      <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto max-h-[calc(100vh-280px)] pr-0.5">
        {tarefas.length === 0 ? (
          <div className={cn(
            "p-6 rounded-xl border border-dashed text-center text-xs flex flex-col items-center justify-center gap-2",
            isOver ? "border-indigo-300 text-indigo-600 bg-white/60" : "border-slate-300/80 text-slate-400 bg-white/40"
          )}>
            <span className="text-[11px] font-medium">Nenhuma tarefa aqui</span>
            <button
              type="button"
              onClick={() => onAddNew(status)}
              className="text-[10px] text-indigo-600 font-bold hover:underline cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Criar tarefa
            </button>
          </div>
        ) : (
          tarefas.map(t => (
            <TarefaCard
              key={t.id}
              tarefa={t}
              onEdit={onEdit}
              onDelete={onDelete}
              onMoveStatus={onMoveStatus}
            />
          ))
        )}
      </div>
    </div>
  );
}
