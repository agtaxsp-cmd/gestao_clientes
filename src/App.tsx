import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Clientes from './pages/Clientes';
import Checklist from './pages/Checklist';
import FluxoTrabalho from './pages/FluxoTrabalho';
import Configuracoes from './pages/Configuracoes';
import Login from './pages/Login';
import { cn } from './lib/utils';

function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();

  if (location.pathname === '/login') {
    return <Login />;
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

