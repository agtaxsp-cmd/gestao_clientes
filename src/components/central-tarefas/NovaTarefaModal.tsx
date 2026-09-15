import React, { useState, useEffect } from 'react';
import { CentralTarefa, CentralTarefaStatus, Client, TeamMember } from '../../types';
import { calculateGutScore, getGutCriticity, GUT_DESCRIPTIONS } from '../../lib/gut';
import { X, Save, AlertTriangle, Calendar, Building2, User, Check, Flame } from 'lucide-react';
import { cn } from '../../lib/utils';

interface NovaTarefaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    id?: string;
    titulo: string;
    descricao?: string | null;
    client_id?: string | null;
    responsavel_id?: string | null;
    status: CentralTarefaStatus;
    gravidade: number;
    urgencia: number;
    tendencia: number;
    data_vencimento?: string | null;
  }) => Promise<void>;
  tarefaToEdit?: CentralTarefa | null;
  initialStatus?: CentralTarefaStatus;
  clients: Client[];
  members: TeamMember[];
}

export default function NovaTarefaModal({
  isOpen,
  onClose,
  onSave,
  tarefaToEdit,
  initialStatus = 'todo',
  clients,
  members
}: NovaTarefaModalProps) {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [clientId, setClientId] = useState('');
  const [responsavelId, setResponsavelId] = useState('');
  const [status, setStatus] = useState<CentralTarefaStatus>(initialStatus);
  const [gravidade, setGravidade] = useState(3);
  const [urgencia, setUrgencia] = useState(3);
  const [tendencia, setTendencia] = useState(3);
  const [dataVencimento, setDataVencimento] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (tarefaToEdit) {
      setTitulo(tarefaToEdit.titulo);
      setDescricao(tarefaToEdit.descricao || '');
      setClientId(tarefaToEdit.client_id || '');
      setResponsavelId(tarefaToEdit.responsavel_id || '');
      setStatus(tarefaToEdit.status);
      setGravidade(tarefaToEdit.gravidade || 3);
      setUrgencia(tarefaToEdit.urgencia || 3);
      setTendencia(tarefaToEdit.tendencia || 3);
      setDataVencimento(tarefaToEdit.data_vencimento || '');
    } else {
      setTitulo('');
      setDescricao('');
      setClientId('');
      setResponsavelId('');
      setStatus(initialStatus);
      setGravidade(3);
      setUrgencia(3);
      setTendencia(3);
      setDataVencimento('');
    }
    setErrorMsg(null);
  }, [tarefaToEdit, initialStatus, isOpen]);

  if (!isOpen) return null;

  // Cálculo em tempo real do Score GUT
  const currentGutScore = calculateGutScore(gravidade, urgencia, tendencia);
  const gutMeta = getGutCriticity(currentGutScore);
  const isHighCritical = currentGutScore >= 80;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) {
      setErrorMsg('Por favor, informe o título da tarefa.');
      return;
    }

    try {
      setSaving(true);
      setErrorMsg(null);
      await onSave({
        id: tarefaToEdit?.id,
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        client_id: clientId || null,
        responsavel_id: responsavelId || null,
        status,
        gravidade,
        urgencia,
        tendencia,
        data_vencimento: dataVencimento || null
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar tarefa';
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  // Componente interno para as pílulas 1 a 5
  const renderNumberSelector = (
    value: number,
    onChange: (val: number) => void,
    dimension: 'gravidade' | 'urgencia' | 'tendencia',
    activeColor: string
  ) => {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((num) => {
            const isSelected = value === num;
            return (
              <button
                key={num}
                type="button"
                onClick={() => onChange(num)}
                className={cn(
                  "py-2 rounded-xl text-xs font-black transition-all flex flex-col items-center justify-center cursor-pointer border",
                  isSelected
                    ? cn("text-white shadow-xs scale-102 border-transparent", activeColor)
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
                )}
              >
                <span>{num}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-500 font-medium px-1 italic">
          {GUT_DESCRIPTIONS[dimension][value as keyof typeof GUT_DESCRIPTIONS[typeof dimension]]}
        </p>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {tarefaToEdit ? 'Editar Tarefa' : 'Nova Tarefa — Central de Tarefas'}
              </h3>
              <p className="text-[11px] text-slate-500">
                Priorização inteligente baseada na Matriz GUT (Gravidade, Urgência e Tendência)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5 max-h-[75vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Título */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Título da Tarefa <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Auditoria fiscal de notas fiscais de entrada"
              className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 font-medium text-slate-900"
              required
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Descrição / Observações
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Detalhes sobre o problema, contexto ou ações necessárias..."
              rows={3}
              className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 font-medium text-slate-900 resize-none"
            />
          </div>

          {/* Relacionamentos (Cliente e Responsável) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Empresa / Cliente */}
            <div>
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1 mb-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                Empresa Cliente
              </label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer text-slate-800"
              >
                <option value="">Nenhum (Demanda interna / Geral)</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.razao_social}
                  </option>
                ))}
              </select>
            </div>

            {/* Responsável */}
            <div>
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1 mb-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Responsável
              </label>
              <select
                value={responsavelId}
                onChange={(e) => setResponsavelId(e.target.value)}
                className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer text-slate-800"
              >
                <option value="">Não atribuído</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.nome} ({m.cargo})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status e Data de Vencimento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Status Inicial no Kanban
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CentralTarefaStatus)}
                className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer font-semibold text-slate-800"
              >
                <option value="backlog">Backlog</option>
                <option value="todo">A Fazer</option>
                <option value="in_progress">Em Andamento</option>
                <option value="done">Concluído</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1 mb-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Data de Vencimento (Prazo)
              </label>
              <input
                type="date"
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
                className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer text-slate-800 font-mono"
              />
            </div>
          </div>

          {/* Seção da Matriz GUT */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-500" />
                Matriz GUT — Avaliação de Prioridade
              </span>
              <span className="text-[11px] text-slate-500">
                Selecione notas de 1 a 5 para cada fator
              </span>
            </div>

            {/* Gravidade */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  1. Gravidade (G) — <span className="font-normal text-slate-500">Qual é o impacto?</span>
                </label>
                <span className="text-xs font-black text-slate-900 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                  Nota {gravidade}
                </span>
              </div>
              {renderNumberSelector(gravidade, setGravidade, 'gravidade', 'bg-rose-600')}
            </div>

            {/* Urgência */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  2. Urgência (U) — <span className="font-normal text-slate-500">O prazo pode esperar?</span>
                </label>
                <span className="text-xs font-black text-slate-900 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                  Nota {urgencia}
                </span>
              </div>
              {renderNumberSelector(urgencia, setUrgencia, 'urgencia', 'bg-amber-500')}
            </div>

            {/* Tendência */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  3. Tendência (T) — <span className="font-normal text-slate-500">Se nada for feito, vai piorar?</span>
                </label>
                <span className="text-xs font-black text-slate-900 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                  Nota {tendencia}
                </span>
              </div>
              {renderNumberSelector(tendencia, setTendencia, 'tendencia', 'bg-indigo-600')}
            </div>
          </div>

          {/* Rodapé com Calculadora GUT em Tempo Real */}
          <div className={cn(
            "p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-center justify-between gap-3",
            isHighCritical
              ? "bg-rose-50/90 border-rose-300 ring-2 ring-rose-400/20"
              : "bg-slate-50 border-slate-200"
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg shrink-0",
                isHighCritical ? "bg-rose-600 text-white shadow-sm animate-pulse" : "bg-indigo-600 text-white"
              )}>
                {currentGutScore}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">
                    Score GUT: <strong className={isHighCritical ? "text-rose-700 text-sm font-black" : "text-indigo-700 text-sm font-black"}>{currentGutScore}</strong> (escala 1 a 125)
                  </span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-black border uppercase",
                    gutMeta.badgeBg,
                    gutMeta.badgeText,
                    gutMeta.badgeBorder
                  )}>
                    {gutMeta.label}
                  </span>
                </div>
                <p className={cn("text-[11px] font-medium mt-0.5", isHighCritical ? "text-rose-700 font-bold" : "text-slate-500")}>
                  {isHighCritical
                    ? '⚠️ Atenção: Score superior a 80! Demanda de criticidade elevada com ação imediata requerida.'
                    : `Cálculo: ${gravidade} (G) × ${urgencia} (U) × ${tendencia} (T) = ${currentGutScore}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className={cn(
                  "px-5 py-2 text-xs font-bold text-white rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer",
                  isHighCritical ? "bg-rose-600 hover:bg-rose-700" : "bg-indigo-600 hover:bg-indigo-700",
                  saving && "opacity-60 cursor-not-allowed"
                )}
              >
                {saving ? (
                  <span>Salvando...</span>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{tarefaToEdit ? 'Salvar Alterações' : 'Criar Tarefa'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
