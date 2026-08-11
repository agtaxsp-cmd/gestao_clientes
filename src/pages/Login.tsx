import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logActivity } from '../lib/logger';
import { Mail, Lock, User, Eye, EyeOff, LogIn, UserPlus, AlertCircle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Se já estiver logado, redireciona para o dashboard
  if (user) {
    navigate('/');
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        const userName = data.user?.user_metadata?.full_name || email.split('@')[0];
        logActivity({
          titulo: 'Login Efetuado',
          descricao: `Usuário ${userName} acessou o sistema com sucesso.`,
          tipo_log: 'success',
          usuario_nome: userName,
        });

        setSuccessMessage('Login efetuado com sucesso! Redirecionando...');
        setTimeout(() => {
          navigate('/');
        }, 1000);

      } else {
        // Criar Conta
        if (!fullName.trim()) {
          throw new Error('Por favor, informe seu nome completo.');
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });

        if (error) throw error;

        // Registrar também na tabela de equipe (team_members) para atribuição no workflow
        try {
          const initials = fullName
            .split(' ')
            .map((n) => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();

          await supabase.from('team_members').insert([
            {
              nome: fullName,
              cargo: 'Analista Fiscal',
              iniciais: initials || 'US',
              ui_color_bg: 'bg-indigo-100',
              ui_color_text: 'text-indigo-700',
            },
          ]);
        } catch (teamErr) {
          console.warn('Aviso ao registrar responsável em team_members:', teamErr);
        }

        logActivity({
          titulo: 'Novo Usuário Cadastrado',
          descricao: `Novo usuário registrado: ${fullName} (${email}).`,
          tipo_log: 'success',
          usuario_nome: fullName,
        });

        setSuccessMessage('Cadastro realizado com sucesso! Você já está autenticado.');
        setTimeout(() => {
          navigate('/');
        }, 1200);
      }
    } catch (err: any) {
      console.error('Erro na autenticação:', err);
      let message = err?.message || 'Ocorreu um erro ao processar. Tente novamente.';
      if (message.includes('Invalid login credentials')) {
        message = 'E-mail ou senha incorretos. Verifique suas credenciais.';
      } else if (message.includes('User already registered')) {
        message = 'Este e-mail já está cadastrado. Tente fazer login.';
      } else if (message.includes('Password should be at least')) {
        message = 'A senha deve ter pelo menos 6 caracteres.';
      }
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  // Login de Demonstração / Convidado
  const handleGuestLogin = () => {
    setEmail('admin@agtaxtech.com.br');
    setPassword('12345678');
    setMode('login');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Elementos Decorativos de Fundo */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200/80 p-8 relative z-10 animate-in fade-in zoom-in-95 duration-300">
        {/* Logo da AGTAX Tech */}
        <div className="flex flex-col items-center text-center mb-6">
          <img
            src="https://res.cloudinary.com/rqopehao/image/upload/v1785326307/logo_agtaxtech_semfundo_azul_wkahqd.png"
            alt="AGTAX Tech"
            className="h-16 w-auto object-contain mb-3"
          />
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Painel de Controle e Gestão</h1>
          <p className="text-xs text-slate-500 mt-1">Acesse sua conta para gerenciar clientes, checklists e fluxos</p>
        </div>

        {/* Abas Alternadoras (Login / Cadastro) */}
        <div className="flex bg-slate-100 p-1 rounded-2xl mb-6 border border-slate-200/60">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              mode === 'login'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              <LogIn className="w-3.5 h-3.5" />
              <span>Entrar</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              mode === 'register'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5" />
              <span>Criar Conta</span>
            </div>
          </button>
        </div>

        {/* Mensagem de Erro */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* Mensagem de Sucesso */}
        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-700 animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-semibold">{successMessage}</span>
          </div>
        )}

        {/* Formulário Supabase Auth */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'register' && (
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">Nome Completo</label>
              <div className="relative flex items-center">
                <User className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Gabriel Rocha"
                  className="w-full h-11 pl-9 pr-3 border border-slate-200 rounded-xl text-xs text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">Endereço de E-mail</label>
            <div className="relative flex items-center">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@empresa.com.br"
                className="w-full h-11 pl-9 pr-3 border border-slate-200 rounded-xl text-xs text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">Senha de Acesso</label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full h-11 pl-9 pr-10 border border-slate-200 rounded-xl text-xs text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title={showPassword ? 'Ocultar Senha' : 'Mostrar Senha'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-indigo-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processando...</span>
              </>
            ) : (
              <>
                <span>{mode === 'login' ? 'Entrar no Sistema' : 'Cadastrar Conta'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Botão de Preenchimento Rápido para Teste */}
        <div className="mt-6 pt-4 border-t border-slate-100 text-center">
          <button
            type="button"
            onClick={handleGuestLogin}
            className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold transition-colors cursor-pointer"
          >
            Preencher dados de teste rápido (Demo)
          </button>
        </div>
      </div>
    </div>
  );
}
