import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function EmailSettingsPage() {
  const queryClient = useQueryClient();
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

  const mutation = useMutation({
    mutationFn: (data: any) => api.put('/email/settings', data),
    onSuccess: () => {
      toast.success('Configurações salvas');
      queryClient.invalidateQueries({ queryKey: ['email-settings'] });
    },
    onError: () => toast.error('Erro ao salvar'),
  });

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
    </div>
  );
}
