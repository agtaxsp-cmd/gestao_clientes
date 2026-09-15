import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { CentralTarefa, CentralTarefaStatus } from '../types';
import { calculateGutScore, getGutCriticity } from '../lib/gut';
import { logActivity } from '../lib/logger';

export function useCentralTarefas() {
  const [tarefas, setTarefas] = useState<CentralTarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTarefas = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      setError(null);

      const { data, error: fetchErr } = await supabase
        .from('central_tarefas')
        .select(`
          *,
          client:clients(*),
          responsavel:team_members(*)
        `)
        .order('gut_score', { ascending: false })
        .order('urgencia', { ascending: false })
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;
      setTarefas((data as CentralTarefa[]) || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Erro ao buscar tarefas da Central:', msg);
      setError(msg);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTarefas();
  }, [fetchTarefas]);

  // Criar nova tarefa
  const createTarefa = async (payload: {
    titulo: string;
    descricao?: string | null;
    client_id?: string | null;
    responsavel_id?: string | null;
    status?: CentralTarefaStatus;
    gravidade: number;
    urgencia: number;
    tendencia: number;
    data_vencimento?: string | null;
  }) => {
    try {
      const gravidade = Math.min(5, Math.max(1, Number(payload.gravidade) || 1));
      const urgencia = Math.min(5, Math.max(1, Number(payload.urgencia) || 1));
      const tendencia = Math.min(5, Math.max(1, Number(payload.tendencia) || 1));
      const gut_score = calculateGutScore(gravidade, urgencia, tendencia);

      const { data, error: insertErr } = await supabase
        .from('central_tarefas')
        .insert({
          titulo: payload.titulo.trim(),
          descricao: payload.descricao ? payload.descricao.trim() : null,
          client_id: payload.client_id || null,
          responsavel_id: payload.responsavel_id || null,
          status: payload.status || 'todo',
          gravidade,
          urgencia,
          tendencia,
          data_vencimento: payload.data_vencimento || null
        })
        .select(`
          *,
          client:clients(*),
          responsavel:team_members(*)
        `)
        .single();

      if (insertErr) throw insertErr;

      const newRecord = data as CentralTarefa;
      setTarefas(prev => {
        const next = [newRecord, ...prev];
        return next.sort((a, b) => (b.gut_score || 0) - (a.gut_score || 0));
      });

      // Registrar atividade nas notificações
      const gutMeta = getGutCriticity(newRecord.gut_score);
      await logActivity({
        titulo: 'Nova Tarefa Criada (Central de Tarefas)',
        descricao: `Tarefa "${newRecord.titulo}" criada com Score GUT ${newRecord.gut_score} (${gutMeta.label})${newRecord.client ? ` para ${newRecord.client.razao_social}` : ''}`,
        tipo_log: newRecord.gut_score >= 80 ? 'error' : 'info',
        client_id: newRecord.client_id
      });

      return newRecord;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Erro ao criar tarefa:', msg);
      throw err;
    }
  };

  const STATUS_NAME_MAP: Record<CentralTarefaStatus, string> = {
    backlog: 'Backlog',
    todo: 'A Fazer',
    in_progress: 'Em Andamento',
    done: 'Concluído'
  };

  // Atualizar status (com atualização otimista para o Kanban)
  const updateStatus = async (id: string, newStatus: CentralTarefaStatus) => {
    const previous = [...tarefas];
    const target = previous.find(t => t.id === id);
    if (target && target.status === newStatus) return;

    // Optimistic UI Update
    setTarefas(prev => prev.map(t => t.id === id ? { ...t, status: newStatus, updated_at: new Date().toISOString() } : t));

    try {
      const { error: upErr } = await supabase
        .from('central_tarefas')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (upErr) throw upErr;

      if (target) {
        await logActivity({
          titulo: 'Movimentação na Central de Tarefas',
          descricao: `Tarefa "${target.titulo}" movida de "${STATUS_NAME_MAP[target.status]}" para "${STATUS_NAME_MAP[newStatus]}"`,
          tipo_log: 'info',
          client_id: target.client_id
        });
      }
    } catch (err: unknown) {
      console.error('Erro ao atualizar status da tarefa:', err);
      // Rollback se falhar
      setTarefas(previous);
      throw err;
    }
  };

  // Atualizar dados completos da tarefa
  const updateTarefa = async (id: string, updates: {
    titulo?: string;
    descricao?: string | null;
    client_id?: string | null;
    responsavel_id?: string | null;
    status?: CentralTarefaStatus;
    gravidade?: number;
    urgencia?: number;
    tendencia?: number;
    data_vencimento?: string | null;
  }) => {
    try {
      const current = tarefas.find(t => t.id === id);
      const gravidade = updates.gravidade !== undefined ? updates.gravidade : (current?.gravidade || 3);
      const urgencia = updates.urgencia !== undefined ? updates.urgencia : (current?.urgencia || 3);
      const tendencia = updates.tendencia !== undefined ? updates.tendencia : (current?.tendencia || 3);

      const { data, error: upErr } = await supabase
        .from('central_tarefas')
        .update({
          ...updates,
          gravidade,
          urgencia,
          tendencia,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select(`
          *,
          client:clients(*),
          responsavel:team_members(*)
        `)
        .single();

      if (upErr) throw upErr;

      const updatedRecord = data as CentralTarefa;
      setTarefas(prev => {
        const next = prev.map(t => t.id === id ? updatedRecord : t);
        return next.sort((a, b) => (b.gut_score || 0) - (a.gut_score || 0));
      });

      await logActivity({
        titulo: 'Tarefa Atualizada (Central de Tarefas)',
        descricao: `Tarefa "${updatedRecord.titulo}" atualizada (GUT ${updatedRecord.gut_score})`,
        tipo_log: 'info',
        client_id: updatedRecord.client_id
      });

      return updatedRecord;
    } catch (err: unknown) {
      console.error('Erro ao atualizar tarefa:', err);
      throw err;
    }
  };

  // Excluir tarefa
  const deleteTarefa = async (id: string) => {
    const previous = [...tarefas];
    const deleted = previous.find(t => t.id === id);
    setTarefas(prev => prev.filter(t => t.id !== id));

    try {
      const { error: delErr } = await supabase
        .from('central_tarefas')
        .delete()
        .eq('id', id);

      if (delErr) throw delErr;

      if (deleted) {
        await logActivity({
          titulo: 'Tarefa Excluída (Central de Tarefas)',
          descricao: `Tarefa "${deleted.titulo}" foi removida da Central`,
          tipo_log: 'info',
          client_id: deleted.client_id
        });
      }
    } catch (err: unknown) {
      console.error('Erro ao excluir tarefa:', err);
      setTarefas(previous);
      throw err;
    }
  };

  return {
    tarefas,
    loading,
    error,
    fetchTarefas,
    createTarefa,
    updateStatus,
    updateTarefa,
    deleteTarefa
  };
}
