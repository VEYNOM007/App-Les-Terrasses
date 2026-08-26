'use client';

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { AuthUser, fetchMe, login as apiLogin, logout as apiLogout, register as apiRegister } from '../lib/api';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (data: {
    email: string;
    phone: string;
    password: string;
    fullName: string;
    country?: string;
    address?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const hydrateSession = useCallback(async () => {
    try {
      const me = await fetchMe();
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void hydrateSession();
  }, [hydrateSession]);

  const login = useCallback(async (email: string, password: string) => {
    const { user: logged } = await apiLogin(email, password);
    setUser(logged);
    return logged;
  }, []);

  const register = useCallback(async (data: {
    email: string;
    phone: string;
    password: string;
    fullName: string;
    country?: string;
    address?: string;
  }) => {
    const { user: created } = await apiRegister(data);
    setUser(created);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, login, register, logout }),
    [user, isLoading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>.');
  return ctx;
}
