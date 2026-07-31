/**
 * Interceptors para requisições HTTP
 * Baseado em research.md - interceptors para adicionar token e tratar erros
 */

import { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { apiClient } from '@/lib/api/client';
import { getStoredToken, validateTokenBeforeRequest } from '@/lib/auth/token-manager';
import { clearSession } from '@/lib/auth/session-storage';

/**
 * Configura interceptors de request e response
 */
export function setupInterceptors(): void {
  // Request interceptor: adiciona token JWT ao header Authorization
  apiClient.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = getStoredToken();

      if (token && validateTokenBeforeRequest(token)) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor: trata erros de autenticação (401/403)
  apiClient.interceptors.response.use(
    (response) => {
      return response;
    },
    (error: AxiosError) => {
      if (error.response) {
        const status = error.response.status;

        // Se receber 401 (Unauthorized) ou 403 (Forbidden), sessão expirou ou inválida
        if (status === 401 || status === 403) {
          // Limpa sessão e redireciona para login
          clearSession();

          // Redireciona para login apenas se estiver no cliente
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
      } else if (error.request) {
        // Erro de rede (backend indisponível)
        console.error('Erro de rede:', error.message);
      }

      return Promise.reject(error);
    }
  );
}

/**
 * Remove todos os interceptors (útil para testes ou reset)
 */
export function removeInterceptors(): void {
  apiClient.interceptors.request.clear();
  apiClient.interceptors.response.clear();
}
