import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCircle2, AlertCircle, Info, RefreshCw, LogOut, CheckCheck, X, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ActivityLog } from '../types';
import { cn } from '../lib/utils';

function formatRelativeTime(dateStr: string) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'Agora mesmo';
  if (diffMinutes < 60) return `há ${diffMinutes} min`;
  if (diffHours < 24) return `há ${diffHours} h`;
  if (diffDays < 7) return `há ${diffDays} d`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

interface HeaderProps {
  collapsed?: boolean;
}

export default function Header({ collapsed = false }: HeaderProps) {
  const { user, loading: authLoading, signOut, getUserName } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<ActivityLog[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error('Erro ao carregar notificações:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Inscrever para atualizações em tempo real das notificações
    const channel = supabase
      .channel('activity_logs_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, (payload) => {
        setNotifications((prev) => [payload.new as ActivityLog, ...prev.slice(0, 19)]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Fechar o painel se clicar fora dele
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.lido).length;

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications.filter((n) => !n.lido).map((n) => n.id);
      if (unreadIds.length === 0) return;

      const { error } = await supabase
        .from('activity_logs')
        .update({ lido: true })
        .in('id', unreadIds);

      if (error) throw error;

      setNotifications((prev) => prev.map((n) => ({ ...n, lido: true })));
    } catch (err) {
      console.error('Erro ao marcar notificações como lidas:', err);
    }
  };

  const getLogIcon = (tipo: string) => {
    switch (tipo) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />;
      case 'sync':
        return <RefreshCw className="w-4 h-4 text-amber-600 shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-indigo-600 shrink-0" />;
    }
  };

  const currentUserName = getUserName();

  return (
    <header className={cn(
      "fixed top-0 right-0 h-16 bg-white/80 backdrop-blur-md z-40 px-8 flex items-center justify-between border-b border-slate-200/50 transition-all duration-300",
      collapsed ? "left-16" : "left-60"
    )}>
      {/* Área esquerda do Header */}
      <div className="flex items-center gap-2">
        {/* Espaço limpo sem filtro redundante */}
      </div>

      <div className="flex items-center gap-4 relative" ref={panelRef}>
        {/* Perfil do Usuário Logado & Botão Sair */}
        {authLoading ? (
          <span className="text-xs text-slate-400">Carregando...</span>
        ) : (
          <div className="flex items-center gap-2.5 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200 shadow-2xs">
            <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs uppercase">
              {currentUserName[0] || 'U'}
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-800 leading-tight truncate max-w-[140px]" title={currentUserName}>
                {currentUserName}
              </span>
              <span className="text-[10px] text-emerald-600 font-semibold leading-tight">Autenticado</span>
            </div>
            <button
              onClick={async () => {
                await signOut();
                navigate('/login');
              }}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors cursor-pointer ml-1"
              title="Sair da Conta (Logout)"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Botão do Sininho */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer rounded-full hover:bg-slate-100"
          title="Central de Notificações"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex items-center justify-center min-w-4 h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Painel Dropdown de Notificações */}
        {isOpen && (
          <div className="absolute top-12 right-0 w-96 bg-white rounded-2xl shadow-2xl border border-slate-200/80 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Header do Painel */}
            <div className="p-4 bg-slate-50/80 border-b border-slate-200/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900">Notificações e Movimentações</h3>
                {unreadCount > 0 && (
                  <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                    {unreadCount} novas
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 cursor-pointer"
                    title="Marcar todas como lidas"
                  >
                    <CheckCheck className="w-3.5 h-3.5" /> Marcar lidas
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Lista de Notificações */}
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Nenhuma atividade registrada até o momento.
                </div>
              ) : (
                notifications.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "p-3.5 flex items-start gap-3 hover:bg-slate-50 transition-colors relative",
                      !item.lido && "bg-indigo-50/30"
                    )}
                  >
                    <div className="mt-0.5">{getLogIcon(item.tipo_log)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-semibold text-slate-900 truncate">{item.titulo}</h4>
                        <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                          {formatRelativeTime(item.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed break-words">
                        {item.descricao}
                      </p>
                      <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100">
                        <span className="text-[10px] font-medium text-slate-500 flex items-center gap-1">
                          <User className="w-3 h-3 text-indigo-500" />
                          {item.usuario_nome || 'Administrador'}
                        </span>
                        {!item.lido && (
                          <span className="w-2 h-2 rounded-full bg-indigo-600" title="Não lida" />
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
