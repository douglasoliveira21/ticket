import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function CompanyPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    razaoSocial: '',
    nomeFantasia: '',
    cnpj: '',
    inscricaoMunicipal: '',
    emailFiscal: '',
    telefone: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    cep: '',
    codigoMunicipio: '',
    regimeTributario: '',
    codigoServico: '',
    aliquotaIss: '',
    cnae: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['company'],
    queryFn: () => api.get('/companies/me').then(r => r.data.data),
  });

  useEffect(() => {
    if (data) {
      setForm({
        razaoSocial: data.razaoSocial || '',
        nomeFantasia: data.nomeFantasia || '',
        cnpj: data.cnpj || '',
        inscricaoMunicipal: data.inscricaoMunicipal || '',
        emailFiscal: data.emailFiscal || '',
        telefone: data.telefone || '',
        logradouro: data.logradouro || '',
        numero: data.numero || '',
        complemento: data.complemento || '',
        bairro: data.bairro || '',
        cidade: data.cidade || '',
        uf: data.uf || '',
        cep: data.cep || '',
        codigoMunicipio: data.codigoMunicipio || '',
        regimeTributario: data.regimeTributario || '',
        codigoServico: data.codigoServico || '',
        aliquotaIss: data.aliquotaIss?.toString() || '',
        cnae: data.cnae || '',
      });
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (data: any) => api.put('/companies/me', {
      ...data,
      aliquotaIss: data.aliquotaIss ? parseFloat(data.aliquotaIss) : undefined,
    }),
    onSuccess: () => {
      toast.success('Empresa atualizada com sucesso');
      queryClient.invalidateQueries({ queryKey: ['company'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erro ao atualizar');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate(form);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700"></div></div>;
  }

  return (
    <div className="max-w-4xl">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Dados da Empresa</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Informações Básicas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Razão Social</label>
              <input name="razaoSocial" value={form.razaoSocial} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome Fantasia</label>
              <input name="nomeFantasia" value={form.nomeFantasia} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
              <input name="cnpj" value={form.cnpj} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Inscrição Municipal</label>
              <input name="inscricaoMunicipal" value={form.inscricaoMunicipal} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail Fiscal</label>
              <input name="emailFiscal" type="email" value={form.emailFiscal} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
              <input name="telefone" value={form.telefone} onChange={handleChange} className="input-field" />
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Endereço</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Logradouro</label>
              <input name="logradouro" value={form.logradouro} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
              <input name="numero" value={form.numero} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Complemento</label>
              <input name="complemento" value={form.complemento} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
              <input name="bairro" value={form.bairro} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
              <input name="cidade" value={form.cidade} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">UF</label>
              <input name="uf" value={form.uf} onChange={handleChange} className="input-field" maxLength={2} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
              <input name="cep" value={form.cep} onChange={handleChange} className="input-field" />
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Dados Fiscais</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código Município (IBGE)</label>
              <input name="codigoMunicipio" value={form.codigoMunicipio} onChange={handleChange} className="input-field" placeholder="3106200" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Regime Tributário</label>
              <select name="regimeTributario" value={form.regimeTributario} onChange={handleChange} className="input-field">
                <option value="">Selecione</option>
                <option value="1">Simples Nacional</option>
                <option value="2">Simples Nacional - Excesso</option>
                <option value="3">Regime Normal</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código de Serviço</label>
              <input name="codigoServico" value={form.codigoServico} onChange={handleChange} className="input-field" placeholder="Ex: 12.07" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alíquota ISS (%)</label>
              <input name="aliquotaIss" type="number" step="0.01" value={form.aliquotaIss} onChange={handleChange} className="input-field" placeholder="Ex: 5.00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CNAE</label>
              <input name="cnae" value={form.cnae} onChange={handleChange} className="input-field" placeholder="Ex: 9001-9/99" />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </form>
    </div>
  );
}
