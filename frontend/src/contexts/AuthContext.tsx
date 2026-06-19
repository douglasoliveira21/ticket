import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Company {
  id: string;
  razaoSocial: string;
  cnpj: string;
}

interface AuthContextType {
  user: User | null;
  company: Company | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; companyName: string; cnpj: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      loadUser();
    } else {
      setIsLoading(false);
    }
  }, []);

  async function loadUser() {
    try {
      const response = await api.get('/auth/me');
      if (response.data.success) {
        setUser(response.data.data);
        setCompany(response.data.data.company);
      }
    } catch {
      localStorage.removeItem('token');
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const response = await api.post('/auth/login', { email, password });
    if (response.data.success) {
      localStorage.setItem('token', response.data.data.token);
      setUser(response.data.data.user);
      setCompany(response.data.data.company);
    } else {
      throw new Error(response.data.error);
    }
  }

  async function register(data: { name: string; email: string; password: string; companyName: string; cnpj: string }) {
    const response = await api.post('/auth/register', data);
    if (response.data.success) {
      localStorage.setItem('token', response.data.data.token);
      setUser(response.data.data.user);
      setCompany(response.data.data.company);
    } else {
      throw new Error(response.data.error);
    }
  }

  function logout() {
    localStorage.removeItem('token');
    setUser(null);
    setCompany(null);
  }

  return (
    <AuthContext.Provider value={{ user, company, isLoading, isAuthenticated: !!user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
