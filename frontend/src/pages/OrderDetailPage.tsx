import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { FileText, Send, XCircle } from 'lucide-react';
import { useFeedbackMutation } from '../lib/feedback';
import Spinner from '../components/ui/Spinner';

export default function OrderDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => api.get(`/orders/${id}`).then(r => r.data.data),
  });

  const issueMutation = useFeedbackMutation(
    () => api.post(`/invoices/issue/${id}`),
    { loading: 'Emitindo NFS-e...', success: 'Nota emitida com sucesso', error: 'Erro ao emitir nota' },
    { onSuccess: () => queryClient.invalidateQueries({ queryKey: ['order', id] }) }
  );

  const resendMutation = useFeedbackMutation(
    (invoiceId: string) => api.post(`/email/resend/${invoiceId}`),
    { loading: 'Reenviando e-mail...', success: 'E-mail reenviado com sucesso', error: 'Erro ao reenviar e-mail' }
  );

  const ignoreMutation = useFeedbackMutation(
    () => api.put(`/orders/${id}/ignore`),
    { loading: 'Atualizando status...', success: 'Status atualizado', error: 'Erro ao atualizar status' },
    { onSuccess: () => queryClient.invalidateQueries({ queryKey: ['order', id] }) }
  );

  if (isLoading) {
    return <Spinner wrapperClassName="py-12" />;
  }

  if (!order) return <p>Venda não encontrada</p>;

  const latestInvoice = order.invoices?.[0];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Detalhe da Venda</h2>
        <div className="flex gap-2">
          {(!latestInvoice || latestInvoice.status === 'CANCELLED') && order.orderStatus === 'approved' && !order.ignored && (
            <button onClick={() => issueMutation.mutate()} disabled={issueMutation.isPending} className="btn-primary flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Emitir NFS-e
            </button>
          )}
          {latestInvoice?.status === 'ISSUED' && (
            <button onClick={() => resendMutation.mutate(latestInvoice.id)} disabled={resendMutation.isPending} className="btn-secondary flex items-center gap-2">
              <Send className="w-4 h-4" />
              Reenviar E-mail
            </button>
          )}
          <button onClick={() => ignoreMutation.mutate()} disabled={ignoreMutation.isPending} className="btn-secondary flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            {order.ignored ? 'Restaurar' : 'Ignorar'}
          </button>
        </div>
      </div>

      {/* Order info */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Dados da Venda</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Comprador</p>
            <p className="font-medium">{order.buyerName}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">E-mail</p>
            <p className="font-medium">{order.buyerEmail}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">CPF/CNPJ</p>
            <p className="font-medium">{order.buyerDocument || 'Não informado'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Telefone</p>
            <p className="font-medium">{order.buyerPhone || 'Não informado'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Evento</p>
            <p className="font-medium">{order.event?.name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Tipo de Ingresso</p>
            <p className="font-medium">{order.ticketType || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Valor</p>
            <p className="font-medium text-lg">R$ {order.amount?.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Data da Compra</p>
            <p className="font-medium">{new Date(order.purchaseDate).toLocaleString('pt-BR')}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Status do Pedido</p>
            <span className={`badge-${order.orderStatus === 'approved' ? 'success' : 'warning'}`}>
              {order.orderStatus}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-500">Origem</p>
            <span className="badge-info">{order.origin}</span>
          </div>
        </div>
      </div>

      {/* Invoices */}
      {order.invoices?.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Notas Fiscais</h3>
          <div className="space-y-4">
            {order.invoices.map((invoice: any) => (
              <div key={invoice.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className={`badge-${invoice.status === 'ISSUED' ? 'success' : invoice.status === 'ERROR' ? 'error' : invoice.status === 'CANCELLED' ? 'info' : 'warning'}`}>
                    {invoice.status === 'ISSUED' ? 'Emitida' : invoice.status === 'ERROR' ? 'Erro' : invoice.status === 'CANCELLED' ? 'Cancelada' : 'Processando'}
                  </span>
                  {invoice.dataEmissao && (
                    <span className="text-sm text-gray-500">
                      {new Date(invoice.dataEmissao).toLocaleString('pt-BR')}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Número</p>
                    <p className="font-medium">{invoice.numeroNota || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Chave de Acesso</p>
                    <p className="font-medium break-all">{invoice.chaveAcesso || invoice.codigoVerificacao || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Valor</p>
                    <p className="font-medium">R$ {invoice.valorServico?.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">E-mail</p>
                    <p className="font-medium">{invoice.emailSent ? '✓ Enviado' : 'Não enviado'}</p>
                  </div>
                </div>
                {invoice.errorMessage && (
                  <div className="mt-3 p-3 bg-red-50 rounded text-sm text-red-700">
                    <strong>Erro:</strong> {invoice.errorMessage}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raw payload */}
      {order.rawPayload && (
        <details className="card">
          <summary className="cursor-pointer font-semibold text-gray-700">Payload Sympla (JSON)</summary>
          <pre className="mt-3 bg-gray-50 p-4 rounded text-xs overflow-x-auto">
            {JSON.stringify(order.rawPayload, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
