import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import {
  Calendar,
  ShoppingCart,
  FileText,
  AlertCircle,
  Clock,
  DollarSign,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then(r => r.data.data),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700"></div>
      </div>
    );
  }

  const stats = data?.stats;

  const cards = [
    { label: 'Eventos Importados', value: stats?.totalEvents || 0, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Vendas Importadas', value: stats?.totalOrders || 0, icon: ShoppingCart, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Notas Emitidas', value: stats?.totalInvoicesIssued || 0, icon: FileText, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Notas Pendentes', value: stats?.totalInvoicesPending || 0, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'Notas com Erro', value: stats?.totalInvoicesError || 0, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Faturamento Total', value: `R$ ${(stats?.totalRevenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Valor com NFS-e', value: `R$ ${(stats?.revenueWithInvoice || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="card flex items-center gap-4">
              <div className={`p-3 rounded-lg ${card.bg}`}>
                <Icon className={`w-6 h-6 ${card.color}`} />
              </div>
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-xl font-bold text-gray-900">{card.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Last sync */}
      {data?.lastSync && (
        <div className="card flex items-center gap-3">
          <RefreshCw className="w-5 h-5 text-gray-400" />
          <span className="text-sm text-gray-600">
            Última sincronização: {new Date(data.lastSync).toLocaleString('pt-BR')}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent orders */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Últimas Vendas</h3>
          {data?.recentOrders?.length > 0 ? (
            <div className="space-y-3">
              {data.recentOrders.map((order: any) => (
                <div key={order.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{order.buyerName}</p>
                    <p className="text-xs text-gray-500">{order.event?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-800">
                      R$ {order.amount?.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(order.purchaseDate).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Nenhuma venda importada ainda</p>
          )}
        </div>

        {/* Recent errors */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Últimas Falhas Fiscais</h3>
          {data?.recentErrors?.length > 0 ? (
            <div className="space-y-3">
              {data.recentErrors.map((invoice: any) => (
                <div key={invoice.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{invoice.order?.buyerName}</p>
                    <p className="text-xs text-red-500 truncate max-w-[200px]">{invoice.errorMessage}</p>
                  </div>
                  <span className="badge-error">Erro</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Nenhum erro recente</p>
          )}
        </div>
      </div>
    </div>
  );
}
