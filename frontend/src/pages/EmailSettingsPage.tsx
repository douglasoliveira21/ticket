import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { useFeedbackMutation } from '../lib/feedback';
import Spinner from '../components/ui/Spinner';
import { Send, CheckCircle, XCircle } from 'lucide-react';

export default function EmailSettingsPage() {
  const queryClient = useQueryClient();
  const [testEmail, setTestEmail] = useState('');
  const [logsPage, setLogsPage] = useState(1);
  const [form, setForm] = useState({
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPass: '',
    smtpFrom: '',
    smtpFromName: '',
    useTls: true,
    templateAssunto: 'Nota Fiscal - {evento}',
    templateCorpo: '',
  });

  const { data } = useQuery({
    queryKey: ['email-settings'],
    queryFn: () => api.get('/email/settings').then(r => r.data.data),
  });

  useEffect(() => {
    if (data) {
      setForm({
        smtpHost: data.smtpHost || '',
        smtpPort: data.smtpPort || 587,
        smtpUser: '',
        smtpPass: '',
        smtpFrom: data.smtpFrom || '',
        smtpFromName: data.smtpFromName || '',
        useTls: data.useTls ?? true,
        templateAssunto: data.templateAssunto || 'Nota Fiscal - {evento}',
        templateCorpo: data.templateCorpo || '',
      });
    }
  }, [data]);

  const mutation = useFeedbackMutation(
    (data: any) => api.put('/email/settings', data),
    { loading: 'Salvando configurações...', success: 'Configurações salvas', error: 'Erro ao salvar configurações' },
    { onSuccess: () => queryClient.invalidateQueries({ queryKey: ['email-settings'] }) }
  );

  const testMutation = useFeedbackMutation(
    (toEmail: string) => api.post('/email/test', { toEmail }),
    { loading: 'Enviando e-mail de teste...', success: 'E-mail de teste enviado com sucesso', error: 'Erro ao enviar e-mail de teste' },
    { onSuccess: () => queryClient.invalidateQueries({ queryKey: ['email-logs'] }) }
  );

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['email-logs', logsPage],
    queryFn: () => api.get('/email/logs', { params: { page: logsPage, limit: 10 } }).then(r => r.data),
  });

  function handleSendTest(e: React.FormEvent) {
    e.preventDefault();
    if (!testEmail) return;
    testMutation.mutate(testEmail, { onSuccess: () => setTestEmail('') });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Only send non-empty values
    const payload: any = {};
    if (form.smtpHost) payload.smtpHost = form.smtpHost;
    if (form.smtpPort) payload.smtpPort = form.smtpPort;
    if (form.smtpUser) payload.smtpUser = form.smtpUser;
    if (form.smtpPass) payload.smtpPass = form.smtpPass;
    if (form.smtpFrom) payload.smtpFrom = form.smtpFrom;
    if (form.smtpFromName) payload.smtpFromName = form.smtpFromName;
    payload.useTls = form.useTls;
    if (form.templateAssunto) payload.templateAssunto = form.templateAssunto;
    if (form.templateCorpo) payload.templateCorpo = form.templateCorpo;

    mutation.mutate(payload);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Configurações de E-mail</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Servidor SMTP</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Host SMTP</label>
              <input value={form.smtpHost} onChange={e => setForm({ ...form, smtpHost: e.target.value })} className="input-field" placeholder="smtp.gmail.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Porta</label>
              <input type="number" value={form.smtpPort} onChange={e => setForm({ ...form, smtpPort: parseInt(e.target.value) })} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Usuário</label>
              <input value={form.smtpUser} onChange={e => setForm({ ...form, smtpUser: e.target.value })} className="input-field" placeholder="seu@email.com" />
              {data?.hasCredentials && <p className="text-xs text-green-600 mt-1">✓ Credenciais configuradas</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <input type="password" value={form.smtpPass} onChange={e => setForm({ ...form, smtpPass: e.target.value })} className="input-field" placeholder="••••••••" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail remetente</label>
              <input type="email" value={form.smtpFrom} onChange={e => setForm({ ...form, smtpFrom: e.target.value })} className="input-field" placeholder="noreply@empresa.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome do remetente</label>
              <input value={form.smtpFromName} onChange={e => setForm({ ...form, smtpFromName: e.target.value })} className="input-field" placeholder="Gestão Fiscal" />
            </div>
            <div className="flex items-center gap-2 md:col-span-2">
              <input
                type="checkbox"
                checked={form.useTls}
                onChange={e => setForm({ ...form, useTls: e.target.checked })}
                id="useTls"
                className="rounded"
              />
              <label htmlFor="useTls" className="text-sm text-gray-700">Usar TLS/SSL</label>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Template do E-mail</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assunto</label>
              <input value={form.templateAssunto} onChange={e => setForm({ ...form, templateAssunto: e.target.value })} className="input-field" />
              <p className="text-xs text-gray-500 mt-1">Use {'{evento}'} para nome do evento</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      </form>

      {/* Teste de e-mail */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-1">Testar Configurações</h3>
        <p className="text-sm text-gray-600 mb-4">
          Envia um e-mail simples para validar se as configurações de SMTP acima estão funcionando.
        </p>
        <form onSubmit={handleSendTest} className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            value={testEmail}
            onChange={e => setTestEmail(e.target.value)}
            className="input-field flex-1"
            placeholder="destinatario@teste.com"
            required
          />
          <button type="submit" disabled={testMutation.isPending} className="btn-secondary flex items-center gap-2 justify-center">
            <Send className="w-4 h-4" />
            {testMutation.isPending ? 'Enviando...' : 'Enviar Teste'}
          </button>
        </form>
      </div>

      {/* Histórico de envios */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Histórico de Envios</h3>
        {logsLoading ? (
          <Spinner />
        ) : logsData?.data?.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="py-2 px-2 text-left font-medium text-gray-600">Destinatário</th>
                    <th className="py-2 px-2 text-left font-medium text-gray-600">Assunto</th>
                    <th className="py-2 px-2 text-left font-medium text-gray-600">Nota</th>
                    <th className="py-2 px-2 text-left font-medium text-gray-600">Status</th>
                    <th className="py-2 px-2 text-left font-medium text-gray-600">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {logsData.data.map((log: any) => (
                    <tr key={log.id} className="border-b border-gray-50">
                      <td className="py-2 px-2">
                        <p className="font-medium">{log.toEmail}</p>
                        {log.toName && <p className="text-xs text-gray-500">{log.toName}</p>}
                      </td>
                      <td className="py-2 px-2 text-gray-600">{log.subject}</td>
                      <td className="py-2 px-2 text-gray-600">{log.invoice?.numeroNota || '-'}</td>
                      <td className="py-2 px-2">
                        {log.status === 'sent' ? (
                          <span className="badge-success flex items-center gap-1 w-fit">
                            <CheckCircle className="w-3 h-3" /> Enviado
                          </span>
                        ) : (
                          <span className="badge-error flex items-center gap-1 w-fit" title={log.errorMessage || ''}>
                            <XCircle className="w-3 h-3" /> {log.errorMessage || 'Falha'}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-gray-600">
                        {new Date(log.sentAt).toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {logsData.pagination?.pages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-gray-500">{logsData.pagination.total} envios</p>
                <div className="flex gap-2">
                  <button onClick={() => setLogsPage(p => Math.max(1, p - 1))} disabled={logsPage === 1} className="btn-secondary text-sm">Anterior</button>
                  <span className="px-3 py-2 text-sm">{logsPage} / {logsData.pagination.pages}</span>
                  <button onClick={() => setLogsPage(p => Math.min(logsData.pagination.pages, p + 1))} disabled={logsPage === logsData.pagination.pages} className="btn-secondary text-sm">Próxima</button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">Nenhum e-mail enviado ainda</p>
          </div>
        )}
      </div>
    </div>
  );
}
