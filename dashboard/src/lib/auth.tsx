'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api';

interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  plan: string;
  settings: any;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem('smartmail_token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.getUser();
      if (res.success && res.data) {
        setUser(res.data);
      }
    } catch {
      localStorage.removeItem('smartmail_token');
      localStorage.removeItem('smartmail_refresh_token');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Check for tokens in URL (OAuth callback)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const accessToken = params.get('accessToken');
      const refreshToken = params.get('refreshToken');

      if (accessToken && refreshToken) {
        localStorage.setItem('smartmail_token', accessToken);
        localStorage.setItem('smartmail_refresh_token', refreshToken);
        window.history.replaceState({}, '', window.location.pathname);
      }
    }

    fetchUser();
  }, [fetchUser]);

  const login = () => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
    window.location.href = `${apiBase}/auth/google`;
  };

  const logout = () => {
    localStorage.removeItem('smartmail_token');
    localStorage.removeItem('smartmail_refresh_token');
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
