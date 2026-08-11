import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, ClipboardCheck, GitMerge, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export default function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Clientes', path: '/clientes', icon: Users },
    { name: 'Checklist', path: '/checklist', icon: ClipboardCheck },
    { name: 'Fluxo de Trabalho', path: '/fluxo-de-trabalho', icon: GitMerge },
    { name: 'Configurações', path: '/configuracoes', icon: Settings },
  ];

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-full bg-white z-50 flex flex-col border-r border-slate-200 shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-all duration-300",
      collapsed ? "w-16" : "w-60"
    )}>
      {/* Header com Logo Ampliada e Centralizada e Botão Toggle */}
      <div className={cn(
        "py-4 px-3 flex items-center justify-center border-b border-slate-100 min-h-[90px] relative",
        collapsed ? "px-2" : "px-4"
      )}>
        {!collapsed ? (
          <img 
            src="https://res.cloudinary.com/rqopehao/image/upload/v1785326307/logo_agtaxtech_semfundo_azul_wkahqd.png" 
            alt="AGTAX Tech Logo" 
            className="h-16 w-auto object-contain max-w-[190px] mx-auto transition-all"
          />
        ) : (
          <img 
            src="https://res.cloudinary.com/rqopehao/image/upload/v1785326307/logo_agtaxtech_semfundo_azul_wkahqd.png" 
            alt="AGTAX Tech Logo" 
            className="h-9 w-9 object-cover object-left rounded-lg transition-all mx-auto"
          />
        )}

        {/* Botão para Minimizar / Expandir */}
        <button
          onClick={onToggle}
          className={cn(
            "p-1 rounded-full text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition-all cursor-pointer shadow-2xs z-10",
            collapsed ? "absolute -right-3 top-6 bg-white" : "absolute right-2 top-3"
          )}
          title={collapsed ? "Expandir Menu" : "Minimizar Menu"}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Itens de Navegação */}
      <nav className="flex-1 px-3 mt-6 pb-6 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            title={collapsed ? item.name : undefined}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all group",
                collapsed && "justify-center px-2",
                isActive
                  ? "bg-indigo-600 text-white font-semibold shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )
            }
          >
            <item.icon className={cn("w-5 h-5 shrink-0 transition-transform group-hover:scale-110")} />
            {!collapsed && <span className="text-sm truncate">{item.name}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
