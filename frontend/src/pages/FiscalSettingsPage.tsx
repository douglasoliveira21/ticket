import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function FiscalSettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    prefeitura: 'BH',
    ambiente: 'homologacao',
    urlWebservice: '',
    usuarioWebservice: '',
    senhaWebservice: '',
    serieRps: '1',
    proximoNumeroRps: 1,
    descricaoPadrao: '',
  });

  const { data } = useQuery({
    queryKey: ['fiscal-settings'],
    queryFn: () => api.get('/companies/fiscal-settings').then(r => r.data.data),
  });

  useEffect(() => {
    if (data) {
      setForm({
        prefeitura: data.prefeitura || 'BH',
        ambiente: data.ambiente || 'homologacao',
        urlWebservice: data.urlWebservice || '',
        usuarioWebservice: '',
        senhaWebservice: '',
        serieRps: data.serieRps || '1',
        proximoNumeroRps: data.proximoNumeroRps || 1,
        descricaoPadrao: data.descricaoPadrao || '',
      });
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (data: any) => api.put('/companies/fiscal-settings', data),
    onSuccess: () => {
      toast.success('Configurações fiscais atualizadas');
      queryClient.invalidateQueries({ queryKey: ['fiscal-settings'] });
    },
    onError: () => toast.error('Erro ao salvar'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.usuarioWebservice) delete payload.usuarioWebservice;
    if (!payload.senhaWebservice) delete payload.senhaWebservice;
    mutation.mutate(payload);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Configurações Fiscais - NFS-e</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Webservice NFS-e</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prefeitura</label>
              <select value={form.prefeitura} onChange={e => setForm({ ...form, prefeitura: e.target.value })} className="input-field">
                <option value="BH">Belo Horizonte</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ambiente</label>
              <select value={form.ambiente} onChange={e => setForm({ ...form, ambiente: e.target.value })} className="input-field">
                <option value="homologacao">Homologação</option>
                <option value="producao">Produção</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">URL do Webservice</label>
              <input value={form.urlWebservice} onChange={e => setForm({ ...form, urlWebservice: e.target.value })} className="input-field" placeholder="https://bhissdigital.pbh.gov.br/bhiss-ws/nfse" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Usuário Webservice</label>
              <input value={form.usuarioWebservice} onChange={e => setForm({ ...form, usuarioWebservice: e.target.value })} className="input-field" />
              {data?.hasCredentials && <p className="text-xs text-green-600 mt-1">✓ Configurado</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha Webservice</label>
              <input type="password" value={form.senhaWebservice} onChange={e => setForm({ ...form, senhaWebservice: e.target.value })} className="input-field" />
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold mb-4">RPS</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Série RPS</label>
              <input value={form.serieRps} onChange={e => setForm({ ...form, serieRps: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Próximo Número RPS</label>
              <input type="number" value={form.proximoNumeroRps} onChange={e => setForm({ ...form, proximoNumeroRps: parseInt(e.target.value) })} className="input-field" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição Padrão do Serviço</label>
              <input value={form.descricaoPadrao} onChange={e => setForm({ ...form, descricaoPadrao: e.target.value })} className="input-field" placeholder="Serviço de organização e gestão de eventos" />
            </div>
          </div>
        </div>

        <div className="card bg-yellow-50 border-yellow-200">
          <h4 className="font-medium text-yellow-800 mb-2">⚠️ Importante</h4>
          <ul className="text-sm text-yellow-700 space-y-1 list-disc pl-4">
            <li>Em modo Homologação, as notas são simuladas (não são enviadas à Prefeitura).</li>
            <li>Para Produção, é necessário certificado digital A1 e credenciais do BHISS Digital.</li>
            <li>Configure primeiro os dados da empresa (CNPJ, Inscrição Municipal, código de serviço).</li>
          </ul>
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
