import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { ScrollText } from 'lucide-react';

export default function AuditPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['audit', page],
    queryFn: () => api.get('/audit', { params: { page, limit: 30 } }).then(r => r.data),
  });

  const logs = data?.data || [];
  const pagination = data?.pagination;

  const actionLabels: Record<string, string> = {
    LOGIN: 'Login',
    REGISTER: 'Cadastro',
    UPDATE_COMPANY: 'Atualização empresa',
    UPDATE_FISCAL_SETTINGS: 'Config. fiscal',
    CREATE_SYMPLA_INTEGRATION: 'Nova integração',
    DELETE_SYMPLA_INTEGRATION: 'Removeu integração',
    IMPORT_SYMPLA_EVENTS: 'Importou eventos',
    SYNC_SYMPLA_ORDERS: 'Sincronizou vendas',
    ISSUE_NFSE: 'Emitiu NFS-e',
    CANCEL_NFSE: 'Cancelou NFS-e',
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Logs e Auditoria</h2>

      <div className="card overflow-x-auto">
        {isLoading ? (
          <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700"></div></div>
        ) : logs.length > 0 ? (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-3 px-2 text-left font-medium text-gray-600">Data/Hora</th>
                  <th className="py-3 px-2 text-left font-medium text-gray-600">Usuário</th>
                  <th className="py-3 px-2 text-left font-medium text-gray-600">Ação</th>
                  <th className="py-3 px-2 text-left font-medium text-gray-600">Entidade</th>
                  <th className="py-3 px-2 text-left font-medium text-gray-600">IP</th>
                  <th className="py-3 px-2 text-left font-medium text-gray-600">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: any) => (
                  <tr key={log.id} className="border-b border-gray-50">
                    <td className="py-3 px-2 text-gray-600">
                      {new Date(log.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-2">{log.user?.name || '-'}</td>
                    <td className="py-3 px-2">
                      <span className="badge-info">{actionLabels[log.action] || log.action}</span>
                    </td>
                    <td className="py-3 px-2 text-gray-600">{log.entity}</td>
                    <td className="py-3 px-2 text-gray-500 text-xs">{log.ip || '-'}</td>
                    <td className="py-3 px-2 text-xs text-gray-500 max-w-[200px] truncate">
                      {log.details ? JSON.stringify(log.details) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {pagination && pagination.pages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-gray-500">{pagination.total} registros</p>
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
            <ScrollText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nenhum log registrado</p>
          </div>
        )}
      </div>
    </div>
  );
}
