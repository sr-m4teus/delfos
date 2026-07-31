/**
 * Hook para gerenciar autenticação
 * Wrapper para useAuthContext com interface simplificada
 */

import { useAuthContext } from '@/lib/auth/auth-context';
import type { LoginRequest, RegisterRequest } from '@/types/auth';

/**
 * Hook useAuth - retorna estado e funções de autenticação
 */
export function useAuth() {
  const authContext = useAuthContext();

  return {
    // Estado
    user: authContext.user,
    session: authContext.session,
    isAuthenticated: authContext.isAuthenticated,
    isLoading: authContext.isLoading,
    error: authContext.error,

    // Ações
    login: authContext.login,
    register: authContext.register,
    logout: authContext.logout,
    checkSession: authContext.checkSession,
    clearError: authContext.clearError,
  };
}

export default useAuth;
