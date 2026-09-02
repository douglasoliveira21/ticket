import { Link, useLocation } from 'react-router-dom';

const tabs = [
  { path: '/empresa', label: 'Empresa' },
  { path: '/configuracoes/fiscal', label: 'Fiscal' },
  { path: '/configuracoes/email', label: 'E-mail' },
];

export default function SettingsTabs() {
  const location = useLocation();

  return (
    <div className="border-b border-gray-200 -mt-2">
      <nav className="flex gap-1" aria-label="Abas de configuração">
        {tabs.map((tab) => {
          const active = location.pathname === tab.path || location.pathname.startsWith(tab.path + '/');
          return (
            <Link
              key={tab.path}
              to={tab.path}
              aria-current={active ? 'page' : undefined}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active
                  ? 'border-primary-700 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
