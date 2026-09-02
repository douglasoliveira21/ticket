import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { RotateCcw, Send, FileText, Download, XCircle, FileCode, X } from 'lucide-react';
import { useFeedbackMutation, withToastFeedback } from '../lib/feedback';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';

export default function InvoicesPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [emailModal, setEmailModal] = useState<{ invoiceId: string; buyerName: string; buyerEmail: string } | null>(null);
  const [emailMessage, setEmailMessage] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', page, statusFilter],
    queryFn: () => api.get('/invoices', {
      params: { page, limit: 20, status: statusFilter || undefined },
    }).then(r => r.data),
  });

  const retryMutation = useFeedbackMutation(
    (id: string) => api.post(`/invoices/${id}/retry`),
    { loading: 'Reprocessando nota...', success: 'Nota reprocessada com sucesso', error: 'Erro ao reprocessar nota' },
    { onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }) }
  );

  const resendMutation = useFeedbackMutation(
    ({ id, message }: { id: string; message: string }) => api.post(`/email/resend/${id}`, { message }),
    { loading: 'Enviando e-mail...', success: 'E-mail enviado com sucesso', error: 'Erro ao enviar e-mail' },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
        setEmailModal(null);
        setEmailMessage('');
      },
    }
  );

  const cancelMutation = useFeedbackMutation(
    ({ id, codigoCancelamento }: { id: string; codigoCancelamento: string }) =>
      api.post(`/invoices/${id}/cancel`, { codigoCancelamento }),
    { loading: 'Cancelando nota...', success: 'Nota cancelada com sucesso', error: 'Erro ao cancelar nota' },
    { onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }) }
  );

  const invoices = data?.data || [];
  const pagination = data?.pagination;

  function handleCancelInvoice(invoiceId: string, numeroNota: string | null) {
    const motivo = window.prompt(
      `Cancelar nota ${numeroNota || ''}?\n\nInforme o motivo:\n1 - Erro na emissão\n2 - Serviço não prestado\n3 - Duplicidade\n\nDigite 1, 2 ou 3:`,
      '2'
    );
    if (!motivo || !['1', '2', '3'].includes(motivo)) return;
    cancelMutation.mutate({ id: invoiceId, codigoCancelamento: motivo });
  }

  async function handleDownloadXml(invoiceId: string, numeroNota: string | null) {
    await withToastFeedback(
      async () => {
        const response = await api.get(`/invoices/${invoiceId}/download-xml`, { responseType: 'blob' });
        const blob = new Blob([response.data], { type: 'application/xml' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nfse-${numeroNota || 'nota'}.xml`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      },
      { loading: 'Baixando XML...', success: 'Download concluído', error: 'Erro ao baixar XML da nota' }
    ).catch(() => {});
  }

  async function handleDownloadPdf(invoiceId: string, numeroNota: string | null) {
    await withToastFeedback(
      async () => {
        const response = await api.get(`/invoices/${invoiceId}/download-pdf`, { responseType: 'blob' });
        const contentType = String(response.headers['content-type'] || 'application/pdf');
        const ext = contentType.includes('pdf') ? 'pdf' : 'html';
        const blob = new Blob([response.data], { type: contentType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `danfse-${numeroNota || 'nota'}.${ext}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      },
      { loading: 'Baixando nota fiscal...', success: 'Download concluído', error: 'Erro ao baixar nota fiscal' }
    ).catch(() => {});
  }

  function openEmailModal(invoice: any) {
    setEmailModal({
      invoiceId: invoice.id,
      buyerName: invoice.order?.buyerName || '',
      buyerEmail: invoice.order?.buyerEmail || '',
    });
    setEmailMessage('');
  }

  function handleSendEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!emailModal) return;
    resendMutation.mutate({ id: emailModal.invoiceId, message: emailMessage });
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1>Notas Fiscais</h1>
        <p>Acompanhe as NFS-e emitidas, pendentes e com erro.</p>
      </div>

      <div className="card">
        <div className="flex items-center gap-4 mb-4">
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
          {statusFilter && (
            <button onClick={() => { setStatusFilter(''); setPage(1); }} className="text-sm text-primary-700 hover:underline">
              Limpar filtro
            </button>
          )}
        </div>

        {isLoading ? (
          <Spinner />
        ) : invoices.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 sticky top-0 bg-white">
                    <th className="table-th">Número</th>
                    <th className="table-th">Cliente</th>
                    <th className="table-th">Evento</th>
                    <th className="table-th text-right">Valor</th>
                    <th className="table-th">Status</th>
                    <th className="table-th">Data Emissão</th>
                    <th className="table-th">E-mail</th>
                    <th className="table-th">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice: any) => (
                    <tr key={invoice.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="table-td font-medium">{invoice.numeroNota || '-'}</td>
                      <td className="table-td">
                        <p>{invoice.order?.buyerName}</p>
                        <p className="text-xs text-gray-500">{invoice.order?.buyerEmail}</p>
                      </td>
                      <td className="table-td text-gray-600">{invoice.order?.event?.name || '-'}</td>
                      <td className="table-td text-right tabular-nums">R$ {invoice.valorServico?.toFixed(2)}</td>
                      <td className="table-td">
                        <span className={`badge-${invoice.status === 'ISSUED' ? 'success' : invoice.status === 'ERROR' ? 'error' : invoice.status === 'CANCELLED' ? 'info' : 'warning'}`}>
                          {invoice.status === 'ISSUED' ? 'Emitida' : invoice.status === 'ERROR' ? 'Erro' : invoice.status === 'CANCELLED' ? 'Cancelada' : 'Pendente'}
                        </span>
                      </td>
                      <td className="table-td">
                        {invoice.dataEmissao ? new Date(invoice.dataEmissao).toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="table-td">
                        {invoice.emailSent ? (
                          <span className="text-green-600 text-xs">✓ Enviado</span>
                        ) : (
                          <span className="text-gray-400 text-xs">Não</span>
                        )}
                      </td>
                      <td className="table-td">
                        <div className="flex gap-1">
                          {invoice.status === 'ISSUED' && (
                            <>
                              <button
                                onClick={() => handleDownloadPdf(invoice.id, invoice.numeroNota)}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                                title="Baixar nota fiscal"
                                aria-label="Baixar nota fiscal"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDownloadXml(invoice.id, invoice.numeroNota)}
                                className="p-1.5 text-purple-600 hover:bg-purple-50 rounded"
                                title="Baixar XML"
                                aria-label="Baixar XML"
                              >
                                <FileCode className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => openEmailModal(invoice)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                title="Enviar por e-mail"
                                aria-label="Enviar por e-mail"
                              >
                                <Send className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleCancelInvoice(invoice.id, invoice.numeroNota)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                title="Cancelar nota"
                                aria-label="Cancelar nota"
                                disabled={cancelMutation.isPending && cancelMutation.variables?.id === invoice.id}
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {invoice.status === 'ERROR' && (
                            <button
                              onClick={() => retryMutation.mutate(invoice.id)}
                              disabled={retryMutation.isPending && retryMutation.variables === invoice.id}
                              className="p-1.5 text-orange-600 hover:bg-orange-50 rounded"
                              title="Tentar novamente"
                              aria-label="Tentar novamente"
                            >
                              <RotateCcw className="w-4 h-4" />
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
          <EmptyState icon={FileText} title="Nenhuma nota fiscal encontrada" />
        )}
      </div>

      {/* Modal de envio de e-mail */}
      {emailModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Enviar Nota por E-mail</h3>
              <button onClick={() => setEmailModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendEmail} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Destinatário</label>
                <p className="text-sm text-gray-600">{emailModal.buyerName} ({emailModal.buyerEmail})</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mensagem personalizada <span className="text-gray-400">(opcional)</span>
                </label>
                <textarea
                  value={emailMessage}
                  onChange={e => setEmailMessage(e.target.value)}
                  className="input-field min-h-[100px]"
                  placeholder="Escreva uma mensagem para o destinatário..."
                />
              </div>

              <p className="text-xs text-gray-500">
                O e-mail será enviado com a nota fiscal e o XML em anexo.
              </p>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEmailModal(null)} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={resendMutation.isPending} className="btn-primary flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  {resendMutation.isPending ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
