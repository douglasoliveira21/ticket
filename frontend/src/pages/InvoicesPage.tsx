import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import toast from 'react-hot-toast';
import { RotateCcw, Send, FileText } from 'lucide-react';

export default function InvoicesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', page, statusFilter],
    queryFn: () => api.get('/invoices', {
      params: { page, limit: 20, status: statusFilter || undefined },
    }).then(r => r.data),
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => api.post(`/invoices/${id}/retry`),
    onSuccess: () => {
      toast.success('Nota reprocessada');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Erro'),
  });

  const resendMutation = useMutation({
    mutationFn: (id: string) => api.post(`/email/resend/${id}`),
    onSuccess: () => toast.success('E-mail reenviado'),
    onError: () => toast.error('Erro ao reenviar'),
  });

  const invoices = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Notas Fiscais</h2>
      </div>

      <div className="card">
        <div className="flex gap-4 mb-4">
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="input-field max-w-[200px]"
          >
            <option value="">Todas</option>
            <option value="ISSUED">Emitidas</option>
            <option value="PENDING">Pendentes</option>
            <option value="PROCESSING">Processando</option>
            <option value="ERROR">Com erro</option>
            <option value="CANCELLED">Canceladas</option>
          </select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700"></div></div>
        ) : invoices.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="py-3 px-2 text-left font-medium text-gray-600">Número</th>
                    <th className="py-3 px-2 text-left font-medium text-gray-600">Cliente</th>
                    <th className="py-3 px-2 text-left font-medium text-gray-600">Evento</th>
                    <th className="py-3 px-2 text-left font-medium text-gray-600">Valor</th>
                    <th className="py-3 px-2 text-left font-medium text-gray-600">Status</th>
                    <th className="py-3 px-2 text-left font-medium text-gray-600">Data Emissão</th>
                    <th className="py-3 px-2 text-left font-medium text-gray-600">E-mail</th>
                    <th className="py-3 px-2 text-left font-medium text-gray-600">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice: any) => (
                    <tr key={invoice.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-2 font-medium">{invoice.numeroNota || '-'}</td>
                      <td className="py-3 px-2">
                        <p>{invoice.order?.buyerName}</p>
                        <p className="text-xs text-gray-500">{invoice.order?.buyerEmail}</p>
                      </td>
                      <td className="py-3 px-2 text-gray-600">{invoice.order?.event?.name || '-'}</td>
                      <td className="py-3 px-2">R$ {invoice.valorServico?.toFixed(2)}</td>
                      <td className="py-3 px-2">
                        <span className={`badge-${invoice.status === 'ISSUED' ? 'success' : invoice.status === 'ERROR' ? 'error' : invoice.status === 'CANCELLED' ? 'info' : 'warning'}`}>
                          {invoice.status === 'ISSUED' ? 'Emitida' : invoice.status === 'ERROR' ? 'Erro' : invoice.status === 'CANCELLED' ? 'Cancelada' : 'Pendente'}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        {invoice.dataEmissao ? new Date(invoice.dataEmissao).toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="py-3 px-2">
                        {invoice.emailSent ? (
                          <span className="text-green-600 text-xs">✓ Enviado</span>
                        ) : (
                          <span className="text-gray-400 text-xs">Não</span>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex gap-1">
                          {invoice.status === 'ERROR' && (
                            <button
                              onClick={() => retryMutation.mutate(invoice.id)}
                              className="p-1.5 text-orange-600 hover:bg-orange-50 rounded"
                              title="Tentar novamente"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                          {invoice.status === 'ISSUED' && (
                            <button
                              onClick={() => resendMutation.mutate(invoice.id)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                              title="Reenviar e-mail"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination && pagination.pages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-gray-500">{pagination.total} notas</p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-sm">Anterior</button>
                  <span className="px-3 py-2 text-sm">{page} / {pagination.pages}</span>
                  <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages} className="btn-secondary text-sm">Próxima</button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nenhuma nota fiscal encontrada</p>
          </div>
        )}
      </div>
    </div>
  );
}
