import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard,
  Building2,
  Link2,
  Calendar,
  ShoppingCart,
  FileText,
  ScrollText,
  Mail,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

const sections = [
  {
    label: 'Principal',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/eventos', label: 'Eventos', icon: Calendar },
      { path: '/vendas', label: 'Vendas', icon: ShoppingCart },
      { path: '/notas-fiscais', label: 'NFS-e', icon: FileText },
    ],
  },
  {
    label: 'Integrações',
    items: [
      { path: '/integracoes/sympla', label: 'Sympla', icon: Link2 },
      { path: '/logs', label: 'Relatórios', icon: ScrollText },
    ],
  },
  {
    label: 'Configurações',
    items: [
      { path: '/empresa', label: 'Empresa', icon: Building2 },
      { path: '/configuracoes/fiscal', label: 'Fiscal', icon: FileText },
      { path: '/configuracoes/email', label: 'E-mail', icon: Mail },
    ],
  },
];

const allItems = sections.flatMap(s => s.items);

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export default function Layout({ children }: LayoutProps) {
  const { user, company, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-primary-700 text-white transform transition-transform lg:relative lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-4 border-b border-primary-600">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary-700" />
              </div>
              <span className="font-bold text-lg">NFS-e</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden" aria-label="Fechar menu">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Company info */}
          <div className="px-4 py-3 border-b border-primary-600">
            <p className="text-sm opacity-80 truncate">{company?.razaoSocial || 'Empresa'}</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-5 overflow-y-auto" aria-label="Navegação principal">
            {sections.map((section) => (
              <div key={section.label}>
                <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-white/50">
                  {section.label}
                </p>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setSidebarOpen(false)}
                        aria-current={active ? 'page' : undefined}
                        className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                          active
                            ? 'bg-white/15 text-white font-medium'
                            : 'text-white/70 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {active && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r bg-white" aria-hidden="true" />
                        )}
                        <Icon className="w-5 h-5 flex-shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-primary-600">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                  {getInitials(user?.name)}
                </div>
                <div className="truncate">
                  <p className="text-sm font-medium truncate">{user?.name}</p>
                  <p className="text-xs text-white/60 truncate">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
                title="Sair"
                aria-label="Sair da conta"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4 lg:px-6 shadow-sm">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden" aria-label="Abrir menu">
            <Menu className="w-6 h-6 text-gray-600" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800 truncate">
            {allItems.find(i => isActive(i.path))?.label || 'Dashboard'}
          </h1>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
