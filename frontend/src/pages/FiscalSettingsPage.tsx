import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Shield, Trash2, CheckCircle, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function FiscalSettingsPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    prefeitura: 'BH',
    ambiente: 'homologacao',
    serieRps: '1',
    proximoNumeroRps: 1,
    descricaoPadrao: '',
  });
  const [certPassword, setCertPassword] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data } = useQuery({
    queryKey: ['fiscal-settings'],
    queryFn: () => api.get('/companies/fiscal-settings').then(r => r.data.data),
  });

  const { data: certData, isLoading: certLoading } = useQuery({
    queryKey: ['certificate-info'],
    queryFn: () => api.get('/companies/certificate').then(r => r.data.data),
  });

  useEffect(() => {
    if (data) {
      setForm({
        prefeitura: data.prefeitura || 'BH',
        ambiente: data.ambiente || 'homologacao',
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

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return api.post('/companies/certificate', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      toast.success('Certificado A1 enviado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['certificate-info'] });
      setSelectedFile(null);
      setCertPassword('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (error: any) => {
      const msg = error.response?.data?.error || 'Erro ao enviar certificado';
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete('/companies/certificate'),
    onSuccess: () => {
      toast.success('Certificado removido');
      queryClient.invalidateQueries({ queryKey: ['certificate-info'] });
    },
    onError: () => toast.error('Erro ao remover certificado'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    mutation.mutate(payload);
  }

  function handleCertUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) {
      toast.error('Selecione o arquivo do certificado (.pfx ou .p12)');
      return;
    }
    if (!certPassword) {
      toast.error('Informe a senha do certificado');
      return;
    }

    const formData = new FormData();
    formData.append('certificado', selectedFile);
    formData.append('senha', certPassword);
    uploadMutation.mutate(formData);
  }

  function handleDeleteCert() {
    if (window.confirm('Tem certeza que deseja remover o certificado digital? A emissão em produção será desabilitada.')) {
      deleteMutation.mutate();
    }
  }

  const certExpired = certData?.isExpired;

  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Configurações Fiscais - NFS-e</h2>

      {/* Certificado Digital A1 */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-semibold">Certificado Digital A1</h3>
        </div>

        {certLoading ? (
          <p className="text-sm text-gray-500">Carregando informações do certificado...</p>
        ) : certData?.hasCertificate ? (
          <div className="space-y-3">
            <div className={`flex items-start gap-3 p-4 rounded-lg border ${certExpired ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
              {certExpired ? (
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
              ) : (
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`font-medium ${certExpired ? 'text-red-800' : 'text-green-800'}`}>
                  {certExpired ? 'Certificado Expirado' : 'Certificado Ativo'}
                </p>
                <div className="text-sm mt-1 space-y-0.5">
                  <p className="text-gray-600">
                    <span className="font-medium">Arquivo:</span> {certData.fileName}
                  </p>
                  {certData.subject && (
                    <p className="text-gray-600">
                      <span className="font-medium">Titular:</span> {certData.subject}
                    </p>
                  )}
                  {certData.validTo && (
                    <p className="text-gray-600">
                      <span className="font-medium">Validade:</span>{' '}
                      {new Date(certData.validTo).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handleDeleteCert}
                disabled={deleteMutation.isPending}
                className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-100 transition-colors"
                title="Remover certificado"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {certExpired && (
              <p className="text-sm text-red-600">
                O certificado expirou. Faça o upload de um novo certificado A1 para continuar emitindo notas em produção.
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleCertUpload} className="space-y-4">
            <p className="text-sm text-gray-600">
              Envie seu certificado digital A1 (arquivo .pfx ou .p12) para habilitar a emissão de NFS-e em produção.
              O certificado será armazenado de forma segura e criptografada.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Arquivo do Certificado (.pfx ou .p12)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pfx,.p12"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Senha do Certificado
              </label>
              <input
                type="password"
                value={certPassword}
                onChange={(e) => setCertPassword(e.target.value)}
                className="input-field"
                placeholder="Senha do arquivo .pfx"
              />
            </div>

            <button
              type="submit"
              disabled={uploadMutation.isPending || !selectedFile || !certPassword}
              className="btn-primary flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {uploadMutation.isPending ? 'Enviando...' : 'Enviar Certificado'}
            </button>
          </form>
        )}

        {/* Substituir certificado existente */}
        {certData?.hasCertificate && !certExpired && (
          <details className="mt-4">
            <summary className="text-sm text-indigo-600 cursor-pointer hover:text-indigo-800">
              Substituir certificado
            </summary>
            <form onSubmit={handleCertUpload} className="mt-3 space-y-3 p-3 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Novo arquivo (.pfx ou .p12)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pfx,.p12"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Senha do novo certificado
                </label>
                <input
                  type="password"
                  value={certPassword}
                  onChange={(e) => setCertPassword(e.target.value)}
                  className="input-field"
                  placeholder="Senha do arquivo .pfx"
                />
              </div>
              <button
                type="submit"
                disabled={uploadMutation.isPending || !selectedFile || !certPassword}
                className="btn-primary text-sm flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                {uploadMutation.isPending ? 'Enviando...' : 'Substituir Certificado'}
              </button>
            </form>
          </details>
        )}
      </div>

      {/* Configurações Gerais */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Configurações Gerais</h3>
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
            <li>Para Produção, é necessário o certificado digital A1 (enviado acima).</li>
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
