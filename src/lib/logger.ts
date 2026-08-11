import { supabase } from './supabase';
import { LogTypeEnum } from '../types';

export async function logActivity({
  titulo,
  descricao,
  tipo_log = 'info',
  client_id = null,
  usuario_nome = 'Administrador'
}: {
  titulo: string;
  descricao: string;
  tipo_log?: LogTypeEnum;
  client_id?: string | null;
  usuario_nome?: string;
}) {
  try {
    const { error } = await supabase.from('activity_logs').insert({
      titulo,
      descricao,
      tipo_log,
      client_id,
      usuario_nome,
      lido: false,
      created_at: new Date().toISOString()
    });

    if (error) console.error('Erro ao registrar log de atividade:', error);
  } catch (err) {
    console.error('Falha ao gravar log de auditoria:', err);
  }
}
