import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Clientes from './pages/Clientes';
import Checklist from './pages/Checklist';
import FluxoTrabalho from './pages/FluxoTrabalho';
import Configuracoes from './pages/Configuracoes';
import Login from './pages/Login';
import { cn } from './lib/utils';
import { Loader2 } from 'lucide-react';

function MainLayout() {
  const { user, loading } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();

  // Tela de Carregando enquanto verifica a sessão do Supabase
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
        <span className="text-sm font-medium text-slate-300">Carregando autenticação Supabase...</span>
      </div>
    );
  }

  // Rota de Login
  if (location.pathname === '/login') {
    if (user) {
      return <Navigate to="/" replace />;
    }
    return <Login />;
  }

  // Se não estiver logado, redireciona para a página de Login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <div className={cn("flex-1 transition-all duration-300", sidebarCollapsed ? "pl-16" : "pl-60")}>
        <Header collapsed={sidebarCollapsed} />
        <main className="pt-16 p-8 max-w-[1280px] mx-auto min-h-screen">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/checklist" element={<Checklist />} />
            <Route path="/fluxo-de-trabalho" element={<FluxoTrabalho />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <MainLayout />
    </Router>
  );
}

