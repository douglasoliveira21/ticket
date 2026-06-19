import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useState } from 'react';

export default function EventDetailPage() {
  const { id } = useParams();
  const [settings, setSettings] = useState({
    autoEmitNfse: false,
    codigoServico: '',
    aliquotaIss: '',
    descricaoServico: '',
  });

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: async () => {
      const r = await api.get(`/events/${id}`);
      const ev = r.data.data;
      setSettings({
        autoEmitNfse: ev.autoEmitNfse || false,
        codigoServico: ev.codigoServico || '',
        aliquotaIss: ev.aliquotaIss?.toString() || '',
        descricaoServico: ev.descricaoServico || '',
      });
      return ev;
    },
  });

  const settingsMutation = useMutation({
    mutationFn: (data: any) => api.put(`/events/${id}/settings`, {
      ...data,
      aliquotaIss: data.aliquotaIss ? parseFloat(data.aliquotaIss) : undefined,
    }),
    onSuccess: () => toast.success('Configurações salvas'),
    onError: () => toast.error('Erro ao salvar'),
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700"></div></div>;
  }

  if (!event) return <p>Evento não encontrado</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">{event.name}</h2>
        <p className="text-gray-500">{event.location} • {event.startDate && new Date(event.startDate).toLocaleDateString('pt-BR')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-3xl font-bold text-gray-800">{event._count?.orders || 0}</p>
          <p className="text-sm text-gray-500">Total de Vendas</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-green-600">
            {event.orders?.filter((o: any) => o.invoices?.length > 0 && o.invoices[0].status === 'ISSUED').length || 0}
          </p>
          <p className="text-sm text-gray-500">Notas Emitidas</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-yellow-600">
            {event.orders?.filter((o: any) => !o.invoices?.length).length || 0}
          </p>
          <p className="text-sm text-gray-500">Pendentes</p>
        </div>
      </div>

      {/* Event settings for NFS-e */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Configurações de Emissão NFS-e</h3>
        <form onSubmit={(e) => { e.preventDefault(); settingsMutation.mutate(settings); }} className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.autoEmitNfse}
              onChange={e => setSettings({ ...settings, autoEmitNfse: e.target.checked })}
              className="w-4 h-4 text-primary-700 rounded"
              id="autoEmit"
            />
            <label htmlFor="autoEmit" className="text-sm font-medium text-gray-700">
              Emitir nota automaticamente para novas vendas importadas
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código de Serviço</label>
              <input
                value={settings.codigoServico}
                onChange={e => setSettings({ ...settings, codigoServico: e.target.value })}
                className="input-field"
                placeholder="Ex: 12.07"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alíquota ISS (%)</label>
              <input
                type="number"
                step="0.01"
                value={settings.aliquotaIss}
                onChange={e => setSettings({ ...settings, aliquotaIss: e.target.value })}
                className="input-field"
                placeholder="5.00"
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição do Serviço</label>
              <input
                value={settings.descricaoServico}
                onChange={e => setSettings({ ...settings, descricaoServico: e.target.value })}
                className="input-field"
                placeholder="Serviço de organização de evento"
              />
            </div>
          </div>
          <button type="submit" disabled={settingsMutation.isPending} className="btn-primary">
            Salvar Configurações
          </button>
        </form>
      </div>

      {/* Recent orders */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Últimas Vendas</h3>
          <Link to={`/vendas?eventId=${id}`} className="text-primary-700 text-sm hover:underline">
            Ver todas
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 font-medium text-gray-600">Cliente</th>
                <th className="text-left py-2 font-medium text-gray-600">Valor</th>
                <th className="text-left py-2 font-medium text-gray-600">Data</th>
                <th className="text-left py-2 font-medium text-gray-600">NFS-e</th>
              </tr>
            </thead>
            <tbody>
              {event.orders?.map((order: any) => (
                <tr key={order.id} className="border-b border-gray-50">
                  <td className="py-2">
                    <p className="font-medium">{order.buyerName}</p>
                    <p className="text-xs text-gray-500">{order.buyerEmail}</p>
                  </td>
                  <td className="py-2">R$ {order.amount?.toFixed(2)}</td>
                  <td className="py-2">{new Date(order.purchaseDate).toLocaleDateString('pt-BR')}</td>
                  <td className="py-2">
                    {order.invoices?.length > 0 ? (
                      <span className={`badge-${order.invoices[0].status === 'ISSUED' ? 'success' : order.invoices[0].status === 'ERROR' ? 'error' : 'warning'}`}>
                        {order.invoices[0].status === 'ISSUED' ? 'Emitida' : order.invoices[0].status === 'ERROR' ? 'Erro' : 'Pendente'}
                      </span>
                    ) : (
                      <span className="badge-warning">Pendente</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
