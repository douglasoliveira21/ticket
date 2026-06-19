import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { FileText, Eye } from 'lucide-react';

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

  const issueMutation = useMutation({
    mutationFn: (orderId: string) => api.post(`/invoices/issue/${orderId}`),
    onSuccess: () => {
      toast.success('Nota emitida com sucesso');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao emitir nota'),
  });

  const batchMutation = useMutation({
    mutationFn: (orderIds: string[]) => api.post('/invoices/issue-batch', { orderIds }),
    onSuccess: (response) => {
      const { success, errors } = response.data.data;
      toast.success(`${success} notas emitidas, ${errors} erros`);
      setSelectedOrders([]);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: () => toast.error('Erro ao processar lote'),
  });

  const orders = data?.data || [];
  const pagination = data?.pagination;

  function toggleSelectOrder(id: string) {
    setSelectedOrders(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function selectAllPending() {
    const pending = orders.filter((o: any) => !o.invoices?.length && o.orderStatus === 'approved' && !o.ignored);
    setSelectedOrders(pending.map((o: any) => o.id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Vendas</h2>
        {selectedOrders.length > 0 && (
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
        )}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-4">
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
          <button onClick={selectAllPending} className="btn-secondary text-sm">
            Selecionar pendentes
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        {isLoading ? (
          <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700"></div></div>
        ) : orders.length > 0 ? (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-3 px-2 text-left">
                    <input
                      type="checkbox"
                      onChange={e => e.target.checked ? selectAllPending() : setSelectedOrders([])}
                      checked={selectedOrders.length > 0}
                      className="rounded"
                    />
                  </th>
                  <th className="py-3 px-2 text-left font-medium text-gray-600">Cliente</th>
                  <th className="py-3 px-2 text-left font-medium text-gray-600">Evento</th>
                  <th className="py-3 px-2 text-left font-medium text-gray-600">Ticket</th>
                  <th className="py-3 px-2 text-left font-medium text-gray-600">Valor</th>
                  <th className="py-3 px-2 text-left font-medium text-gray-600">Data</th>
                  <th className="py-3 px-2 text-left font-medium text-gray-600">NFS-e</th>
                  <th className="py-3 px-2 text-left font-medium text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order: any) => {
                  const invoice = order.invoices?.[0];
                  const canIssue = !invoice && order.orderStatus === 'approved' && !order.ignored;

                  return (
                    <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-2">
                        {canIssue && (
                          <input
                            type="checkbox"
                            checked={selectedOrders.includes(order.id)}
                            onChange={() => toggleSelectOrder(order.id)}
                            className="rounded"
                          />
                        )}
                      </td>
                      <td className="py-3 px-2">
                        <p className="font-medium text-gray-800">{order.buyerName}</p>
                        <p className="text-xs text-gray-500">{order.buyerEmail}</p>
                      </td>
                      <td className="py-3 px-2 text-gray-600">{order.event?.name || '-'}</td>
                      <td className="py-3 px-2 text-gray-600">{order.ticketType || '-'}</td>
                      <td className="py-3 px-2 font-medium">R$ {order.amount?.toFixed(2)}</td>
                      <td className="py-3 px-2 text-gray-600">
                        {new Date(order.purchaseDate).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-3 px-2">
                        {invoice ? (
                          <span className={`badge-${invoice.status === 'ISSUED' ? 'success' : invoice.status === 'ERROR' ? 'error' : 'warning'}`}>
                            {invoice.status === 'ISSUED' ? `Emitida #${invoice.numeroNota}` : invoice.status === 'ERROR' ? 'Erro' : 'Processando'}
                          </span>
                        ) : order.ignored ? (
                          <span className="badge-info">Ignorada</span>
                        ) : (
                          <span className="badge-warning">Pendente</span>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-1">
                          {canIssue && (
                            <button
                              onClick={() => issueMutation.mutate(order.id)}
                              disabled={issueMutation.isPending}
                              className="p-1.5 text-primary-700 hover:bg-primary-50 rounded"
                              title="Emitir NFS-e"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                          )}
                          <Link
                            to={`/vendas/${order.id}`}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                            title="Ver detalhes"
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
          <div className="text-center py-8">
            <p className="text-gray-500">Nenhuma venda encontrada</p>
          </div>
        )}
      </div>
    </div>
  );
}
