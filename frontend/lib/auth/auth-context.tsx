/**
 * Context API para gerenciamento de estado de autenticação
 * Baseado em research.md - decisão de usar React Context API + localStorage
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { login as loginService, register as registerService } from '@/lib/auth/auth-service';
import { saveToken, saveUser, clearSession, getToken, getUser } from '@/lib/auth/session-storage';
import { getStoredToken, getUserFromStoredToken, validateStoredToken } from '@/lib/auth/token-manager';
import { decodeToken } from '@/lib/utils/jwt-utils';
import { setupInterceptors } from '@/lib/api/interceptors';
import type { User, Session, LoginRequest, RegisterRequest } from '@/types/auth';

/**
 * Estado de autenticação
 */
export interface AuthState {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * Valor do contexto de autenticação
 */
export interface AuthContextValue extends AuthState {
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  checkSession: () => Promise<boolean>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Provider do contexto de autenticação
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  // Configurar interceptors na inicialização
  useEffect(() => {
    setupInterceptors();
  }, []);

  // Restaurar sessão ao carregar a aplicação
  useEffect(() => {
    const restoreSession = () => {
      const token = getStoredToken();
      const userData = getUser<User>();

      if (token && userData && validateStoredToken()) {
        const userFromToken = getUserFromStoredToken();
        if (userFromToken) {
          setState({
            user: userData,
            session: {
              token,
              user: userData,
              expiresAt: 0, // Será calculado do token se necessário
              createdAt: Date.now(),
            },
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          return;
        }
      }

      setState((prev) => ({ ...prev, isLoading: false }));
    };

    restoreSession();

    // Sincronizar entre abas usando storage event
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === process.env.NEXT_PUBLIC_TOKEN_STORAGE_KEY || e.key === process.env.NEXT_PUBLIC_USER_STORAGE_KEY) {
        if (!e.newValue) {
          // Token ou usuário foi removido em outra aba
          setState({
            user: null,
            session: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  /**
   * Realiza login do usuário
   */
  const handleLogin = useCallback(async (credentials: LoginRequest) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await loginService(credentials);

      // Calcular expiração do token usando função utilitária com tratamento de erros
      const decoded = decodeToken(response.token);
      if (!decoded || !decoded.exp) {
        throw new Error('Token inválido: não foi possível decodificar ou token não contém expiração');
      }
      const expiresAt = decoded.exp * 1000; // Converter para milissegundos

      const session: Session = {
        token: response.token,
        user: response.user,
        expiresAt,
        createdAt: Date.now(),
      };

      // Salvar no localStorage
      saveToken(response.token);
      saveUser(response.user);

      setState({
        user: response.user,
        session,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao fazer login';
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      throw error;
    }
  }, []);

  /**
   * Registra um novo usuário e autentica automaticamente
   */
  const handleRegister = useCallback(async (data: RegisterRequest) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await registerService(data);

      // Calcular expiração do token usando função utilitária com tratamento de erros
      const decoded = decodeToken(response.token);
      if (!decoded || !decoded.exp) {
        throw new Error('Token inválido: não foi possível decodificar ou token não contém expiração');
      }
      const expiresAt = decoded.exp * 1000; // Converter para milissegundos

      const session: Session = {
        token: response.token,
        user: response.user,
        expiresAt,
        createdAt: Date.now(),
      };

      // Salvar no localStorage
      saveToken(response.token);
      saveUser(response.user);

      setState({
        user: response.user,
        session,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao registrar usuário';
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      throw error;
    }
  }, []);

  /**
   * Faz logout do usuário
   */
  const handleLogout = useCallback(() => {
    clearSession();
    setState({
      user: null,
      session: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  }, []);

  /**
   * Verifica se a sessão atual é válida
   */
  const handleCheckSession = useCallback(async (): Promise<boolean> => {
    return validateStoredToken();
  }, []);

  /**
   * Limpa mensagens de erro
   */
  const handleClearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const value: AuthContextValue = {
    ...state,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
    checkSession: handleCheckSession,
    clearError: handleClearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook para usar o contexto de autenticação
 */
export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext deve ser usado dentro de um AuthProvider');
  }
  return context;
}
