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
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

const menuItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/eventos', label: 'Eventos', icon: Calendar },
  { path: '/vendas', label: 'Vendas', icon: ShoppingCart },
  { path: '/notas-fiscais', label: 'NFS-e', icon: FileText },
  { path: '/integracoes/sympla', label: 'Integrações', icon: Link2 },
  { path: '/logs', label: 'Relatórios', icon: ScrollText },
];

const configItems = [
  { path: '/empresa', label: 'Empresa', icon: Building2 },
  { path: '/configuracoes/fiscal', label: 'Fiscal', icon: FileText },
  { path: '/configuracoes/email', label: 'E-mail', icon: Mail },
];

export default function Layout({ children }: LayoutProps) {
  const { user, company, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

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
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Company info */}
          <div className="px-4 py-3 border-b border-primary-600">
            <p className="text-sm opacity-80 truncate">{company?.razaoSocial || 'Empresa'}</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive(item.path)
                      ? 'bg-white/20 text-white font-medium'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {/* Config section */}
            <div className="pt-4">
              <button
                onClick={() => setConfigOpen(!configOpen)}
                className="flex items-center justify-between w-full px-3 py-2.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Settings className="w-5 h-5" />
                  <span>Configurações</span>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${configOpen ? 'rotate-180' : ''}`} />
              </button>
              {configOpen && (
                <div className="ml-4 mt-1 space-y-1">
                  {configItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          isActive(item.path)
                            ? 'bg-white/20 text-white font-medium'
                            : 'text-white/60 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-primary-600">
            <div className="flex items-center justify-between">
              <div className="truncate">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-white/60 truncate">{user?.email}</p>
              </div>
              <button
                onClick={logout}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                title="Sair"
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
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4 lg:px-6">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden">
            <Menu className="w-6 h-6 text-gray-600" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800 truncate">
            {menuItems.find(i => isActive(i.path))?.label ||
             configItems.find(i => isActive(i.path))?.label ||
             'Dashboard'}
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
