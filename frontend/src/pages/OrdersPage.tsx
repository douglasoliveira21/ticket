import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { FileText, Eye, ShoppingCart } from 'lucide-react';
import { useFeedbackMutation } from '../lib/feedback';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  const eventIdFilter = searchParams.get('eventId') || '';

  const { data, isLoading } = useQuery({
    queryKey: ['orders', page, search, statusFilter, eventIdFilter],
    queryFn: () => api.get('/orders', {
      params: {
        page,
        limit: 20,
        search: search || undefined,
        invoiceStatus: statusFilter || undefined,
        eventId: eventIdFilter || undefined,
      },
    }).then(r => r.data),
  });

  const issueMutation = useFeedbackMutation(
    (orderId: string) => api.post(`/invoices/issue/${orderId}`),
    { loading: 'Emitindo NFS-e...', success: 'Nota emitida com sucesso', error: 'Erro ao emitir nota' },
    { onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] }) }
  );

  const batchMutation = useFeedbackMutation(
    (orderIds: string[]) => api.post('/invoices/issue-batch', { orderIds }),
    {
      loading: `Emitindo ${selectedOrders.length} nota(s)...`,
      success: (response) => {
        const { success, errors } = response.data.data;
        return `${success} notas emitidas, ${errors} erros`;
      },
      error: 'Erro ao processar lote',
    },
    {
      onSuccess: () => {
        setSelectedOrders([]);
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      },
    }
  );

  const orders = data?.data || [];
  const pagination = data?.pagination;
  const hasFilters = !!search || !!statusFilter;

  function toggleSelectOrder(id: string) {
    setSelectedOrders(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function selectAllPending() {
    const pending = orders.filter((o: any) => (!o.invoices?.length || o.invoices[0].status === 'CANCELLED') && o.orderStatus === 'approved' && !o.ignored);
    setSelectedOrders(pending.map((o: any) => o.id));
  }

  function clearFilters() {
    setSearch('');
    setStatusFilter('');
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1>Vendas</h1>
        <p>Vendas importadas e status de emissão de NFS-e.</p>
      </div>

      {/* Barra de ação em lote */}
      {selectedOrders.length > 0 && (
        <div className="card bg-primary-50 border-primary-200 flex items-center justify-between flex-wrap gap-4">
          <p className="text-sm font-medium text-primary-800">
            {selectedOrders.length} venda(s) selecionada(s)
          </p>
          <button
            onClick={() => {
              if (confirm(`Emitir notas para ${selectedOrders.length} vendas selecionadas?`)) {
                batchMutation.mutate(selectedOrders);
              }
            }}
            disabled={batchMutation.isPending}
            className="btn-primary flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Emitir {selectedOrders.length} nota(s)
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-4">
          <input
            type="text"
            placeholder="Buscar por nome ou e-mail..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="input-field max-w-xs"
          />
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="input-field max-w-[200px]"
          >
            <option value="">Todas as notas</option>
            <option value="PENDING">Pendentes</option>
            <option value="ISSUED">Emitidas</option>
            <option value="ERROR">Com erro</option>
          </select>
          {hasFilters && (
            <button onClick={clearFilters} className="text-sm text-primary-700 hover:underline">
              Limpar filtros
            </button>
          )}
          <button onClick={selectAllPending} className="btn-secondary text-sm ml-auto">
            Selecionar pendentes
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        {isLoading ? (
          <Spinner />
        ) : orders.length > 0 ? (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 sticky top-0 bg-white">
                  <th className="table-th">
                    <input
                      type="checkbox"
                      onChange={e => e.target.checked ? selectAllPending() : setSelectedOrders([])}
                      checked={selectedOrders.length > 0}
                      className="rounded"
                      aria-label="Selecionar todas as vendas pendentes"
                    />
                  </th>
                  <th className="table-th">Cliente</th>
                  <th className="table-th">Evento</th>
                  <th className="table-th">Ticket</th>
                  <th className="table-th text-right">Valor</th>
                  <th className="table-th">Data</th>
                  <th className="table-th">NFS-e</th>
                  <th className="table-th">Ações</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order: any) => {
                  const invoice = order.invoices?.[0];
                  const canIssue = (!invoice || invoice.status === 'CANCELLED') && order.orderStatus === 'approved' && !order.ignored;

                  return (
                    <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="table-td">
                        {canIssue && (
                          <input
                            type="checkbox"
                            checked={selectedOrders.includes(order.id)}
                            onChange={() => toggleSelectOrder(order.id)}
                            className="rounded"
                            aria-label={`Selecionar venda de ${order.buyerName}`}
                          />
                        )}
                      </td>
                      <td className="table-td">
                        <p className="font-medium text-gray-800">{order.buyerName}</p>
                        <p className="text-xs text-gray-500">{order.buyerEmail}</p>
                      </td>
                      <td className="table-td text-gray-600">{order.event?.name || '-'}</td>
                      <td className="table-td text-gray-600">{order.ticketType || '-'}</td>
                      <td className="table-td text-right font-medium tabular-nums">R$ {order.amount?.toFixed(2)}</td>
                      <td className="table-td text-gray-600">
                        {new Date(order.purchaseDate).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="table-td">
                        {invoice ? (
                          <span className={`badge-${invoice.status === 'ISSUED' ? 'success' : invoice.status === 'ERROR' ? 'error' : invoice.status === 'CANCELLED' ? 'info' : 'warning'}`}>
                            {invoice.status === 'ISSUED' ? `Emitida #${invoice.numeroNota}` : invoice.status === 'ERROR' ? 'Erro' : invoice.status === 'CANCELLED' ? 'Cancelada' : 'Processando'}
                          </span>
                        ) : order.ignored ? (
                          <span className="badge-info">Ignorada</span>
                        ) : (
                          <span className="badge-warning">Pendente</span>
                        )}
                      </td>
                      <td className="table-td">
                        <div className="flex items-center gap-1">
                          {canIssue && (
                            <button
                              onClick={() => issueMutation.mutate(order.id)}
                              disabled={issueMutation.isPending && issueMutation.variables === order.id}
                              className="p-1.5 text-primary-700 hover:bg-primary-50 rounded"
                              title="Emitir NFS-e"
                              aria-label="Emitir NFS-e"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                          )}
                          <Link
                            to={`/vendas/${order.id}`}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                            title="Ver detalhes"
                            aria-label="Ver detalhes da venda"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-gray-500">
                  {pagination.total} vendas encontradas
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn-secondary text-sm"
                  >
                    Anterior
                  </button>
                  <span className="px-3 py-2 text-sm">
                    {page} / {pagination.pages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                    disabled={page === pagination.pages}
                    className="btn-secondary text-sm"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <EmptyState icon={ShoppingCart} title="Nenhuma venda encontrada" />
        )}
      </div>
    </div>
  );
}
