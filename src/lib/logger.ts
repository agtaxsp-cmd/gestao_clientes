import { supabase } from './supabase';
import { LogTypeEnum } from '../types';

export async function logActivity({
  titulo,
  descricao,
  tipo_log = 'info',
  client_id = null,
  usuario_nome
}: {
  titulo: string;
  descricao: string;
  tipo_log?: LogTypeEnum;
  client_id?: string | null;
  usuario_nome?: string;
}) {
  try {
    let activeUser = usuario_nome;

    // Se o nome não foi informado ou é o valor padrão estático, buscar o usuário logado no Supabase Auth
    if (!activeUser || activeUser === 'Administrador') {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        activeUser =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split('@')[0] ||
          'Usuário Autenticado';
      } else {
        activeUser = 'Administrador';
      }
    }

    const { error } = await supabase.from('activity_logs').insert({
      titulo,
      descricao,
      tipo_log,
      client_id,
      usuario_nome: activeUser,
      lido: false,
      created_at: new Date().toISOString()
    });

    if (error) console.error('Erro ao registrar log de atividade:', error);
  } catch (err) {
    console.error('Falha ao gravar log de auditoria:', err);
  }
}
