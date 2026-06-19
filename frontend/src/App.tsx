import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import CompanyPage from './pages/CompanyPage';
import SymplaPage from './pages/SymplaPage';
import EventsPage from './pages/EventsPage';
import EventDetailPage from './pages/EventDetailPage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import InvoicesPage from './pages/InvoicesPage';
import AuditPage from './pages/AuditPage';
import EmailSettingsPage from './pages/EmailSettingsPage';
import FiscalSettingsPage from './pages/FiscalSettingsPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-700"></div>
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/empresa" element={<CompanyPage />} />
                <Route path="/integracoes/sympla" element={<SymplaPage />} />
                <Route path="/eventos" element={<EventsPage />} />
                <Route path="/eventos/:id" element={<EventDetailPage />} />
                <Route path="/vendas" element={<OrdersPage />} />
                <Route path="/vendas/:id" element={<OrderDetailPage />} />
                <Route path="/notas-fiscais" element={<InvoicesPage />} />
                <Route path="/logs" element={<AuditPage />} />
                <Route path="/configuracoes/email" element={<EmailSettingsPage />} />
                <Route path="/configuracoes/fiscal" element={<FiscalSettingsPage />} />
              </Routes>
            </Layout>
          </PrivateRoute>
        }
      />
    </Routes>
  );
}

export default App;
