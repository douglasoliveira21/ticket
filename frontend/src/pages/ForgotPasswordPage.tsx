import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, ArrowLeft } from 'lucide-react';
import api from '../services/api';
import { withToastFeedback } from '../lib/feedback';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await withToastFeedback(
        () => api.post('/auth/forgot-password', { email }).then(r => r.data),
        { loading: 'Enviando...', success: 'Link de redefinição enviado', error: 'Erro ao enviar solicitação' }
      );
      setSent(true);
    } catch {
      // erro já exibido pelo toast
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-primary-700 rounded-2xl flex items-center justify-center">
              <FileText className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="mt-4 text-3xl font-bold text-gray-900">Esqueceu a senha?</h2>
          <p className="mt-2 text-gray-600">
            Informe seu e-mail e enviaremos um link para redefinir sua senha.
          </p>
        </div>

        <div className="card space-y-6">
          {sent ? (
            <p className="text-sm text-gray-700">
              Se o e-mail <strong>{email}</strong> estiver cadastrado, você receberá um link de
              redefinição de senha em instantes. Verifique também a caixa de spam.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="seu@email.com"
                  required
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Enviando...' : 'Enviar link de redefinição'}
              </button>
            </form>
          )}

          <Link to="/login" className="flex items-center justify-center gap-1.5 text-sm text-primary-700 hover:underline">
            <ArrowLeft className="w-4 h-4" />
            Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  );
}
