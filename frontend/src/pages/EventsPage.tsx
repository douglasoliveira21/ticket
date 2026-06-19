import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { Calendar, ExternalLink, MapPin } from 'lucide-react';

export default function EventsPage() {
  const { data: events, isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => api.get('/events').then(r => r.data.data),
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Eventos</h2>
      </div>

      {events?.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((event: any) => (
            <Link key={event.id} to={`/eventos/${event.id}`} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800 line-clamp-2">{event.name}</h3>
                  {event.location && (
                    <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {event.location}
                    </p>
                  )}
                  {event.startDate && (
                    <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(event.startDate).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>
                {event.origin === 'SYMPLA' && (
                  <span className="badge-info text-xs">Sympla</span>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-gray-800">{event.totalOrders}</p>
                  <p className="text-xs text-gray-500">Vendas</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-green-600">{event.issuedInvoices}</p>
                  <p className="text-xs text-gray-500">Emitidas</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-yellow-600">{event.pendingInvoices}</p>
                  <p className="text-xs text-gray-500">Pendentes</p>
                </div>
              </div>

              {event.url && (
                <a href={event.url} target="_blank" rel="noopener noreferrer" className="mt-3 text-xs text-primary-700 flex items-center gap-1 hover:underline" onClick={e => e.stopPropagation()}>
                  <ExternalLink className="w-3 h-3" /> Ver na Sympla
                </a>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600">Nenhum evento importado</h3>
          <p className="text-gray-400 mt-1">Configure a integração Sympla e importe seus eventos</p>
          <Link to="/integracoes/sympla" className="btn-primary inline-block mt-4">
            Configurar Sympla
          </Link>
        </div>
      )}
    </div>
  );
}
