import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Plus, RefreshCw, Trash2, CheckCircle, XCircle, Link2 } from 'lucide-react';

export default function SymplaPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', token: '' });

  const { data: integrations, isLoading } = useQuery({
    queryKey: ['sympla-integrations'],
    queryFn: () => api.get('/sympla/integrations').then(r => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/sympla/integrations', data),
    onSuccess: () => {
      toast.success('Integração criada');
      queryClient.invalidateQueries({ queryKey: ['sympla-integrations'] });
      setShowForm(false);
      setForm({ name: '', token: '' });
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Erro ao criar'),
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => api.post(`/sympla/integrations/${id}/test`),
    onSuccess: (response) => {
      if (response.data.data.connected) {
        toast.success('Conexão bem-sucedida!');
      } else {
        toast.error('Falha na conexão. Verifique o token.');
      }
    },
    onError: () => toast.error('Erro ao testar conexão'),
  });

  const importEventsMutation = useMutation({
    mutationFn: (id: string) => api.post(`/sympla/integrations/${id}/import-events`),
    onSuccess: (response) => {
      toast.success(`${response.data.data.imported} eventos importados`);
      queryClient.invalidateQueries({ queryKey: ['sympla-integrations'] });
    },
    onError: () => toast.error('Erro ao importar eventos'),
  });

  const syncOrdersMutation = useMutation({
    mutationFn: (id: string) => api.post(`/sympla/integrations/${id}/sync-orders`),
    onSuccess: (response) => {
      toast.success(`${response.data.data.imported} vendas sincronizadas`);
    },
    onError: () => toast.error('Erro ao sincronizar vendas'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sympla/integrations/${id}`),
    onSuccess: () => {
      toast.success('Integração removida');
      queryClient.invalidateQueries({ queryKey: ['sympla-integrations'] });
    },
    onError: () => toast.error('Erro ao remover'),
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Integração Sympla</h2>
          <p className="text-gray-500 mt-1">Configure o token da API Sympla para importar eventos e vendas</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nova Integração
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Adicionar Integração</h3>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome da integração</label>
              <input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="input-field"
                placeholder="Ex: Conta principal Sympla"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Token da API Sympla</label>
              <input
                value={form.token}
                onChange={e => setForm({ ...form, token: e.target.value })}
                className="input-field"
                placeholder="Cole aqui o token da Sympla"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Gere o token em Sympla → Minha Conta → Integrações
              </p>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={createMutation.isPending} className="btn-primary">
                {createMutation.isPending ? 'Salvando...' : 'Salvar'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Integrations list */}
      {integrations?.length > 0 ? (
        <div className="space-y-4">
          {integrations.map((integration: any) => (
            <div key={integration.id} className="card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <Link2 className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800">{integration.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      {integration.isActive ? (
                        <span className="badge-success flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Ativa
                        </span>
                      ) : (
                        <span className="badge-error flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> Inativa
                        </span>
                      )}
                      {integration.lastSync && (
                        <span className="text-xs text-gray-500">
                          Última sync: {new Date(integration.lastSync).toLocaleString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => testMutation.mutate(integration.id)}
                    disabled={testMutation.isPending}
                    className="btn-secondary text-sm"
                  >
                    Testar
                  </button>
                  <button
                    onClick={() => importEventsMutation.mutate(integration.id)}
                    disabled={importEventsMutation.isPending}
                    className="btn-secondary text-sm flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${importEventsMutation.isPending ? 'animate-spin' : ''}`} />
                    Importar Eventos
                  </button>
                  <button
                    onClick={() => syncOrdersMutation.mutate(integration.id)}
                    disabled={syncOrdersMutation.isPending}
                    className="btn-primary text-sm flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${syncOrdersMutation.isPending ? 'animate-spin' : ''}`} />
                    Sincronizar Vendas
                  </button>
                  <button
                    onClick={() => { if (confirm('Remover integração?')) deleteMutation.mutate(integration.id); }}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        !showForm && (
          <div className="card text-center py-12">
            <Link2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600">Nenhuma integração configurada</h3>
            <p className="text-gray-400 mt-1">Adicione o token da Sympla para começar a importar eventos e vendas</p>
          </div>
        )
      )}
    </div>
  );
}
