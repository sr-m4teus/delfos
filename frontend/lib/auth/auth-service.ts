/**
 * Serviço de autenticação - chamadas à API
 * Baseado em contracts/api.yaml
 */

import { post, get } from '@/lib/api/client';
import type { LoginRequest, RegisterRequest, AuthResponse, ErrorResponse, User } from '@/types/auth';

/**
 * Realiza login do usuário
 * @param credentials Credenciais de login (email e senha)
 * @returns Resposta de autenticação com token e dados do usuário
 * @throws Error se as credenciais forem inválidas ou houver erro de rede
 */
export async function login(credentials: LoginRequest): Promise<AuthResponse> {
  const response = await post<AuthResponse>('/api/auth/login', credentials);

  if (response.error) {
    const errorResponse = response.error as unknown as ErrorResponse;
    const errorMessage = errorResponse.message || 'Erro ao fazer login';
    
    // Verificar se é erro de rede
    if (response.status === 0 || errorResponse.error === 'NETWORK_ERROR') {
      throw new Error('Erro ao comunicar com o servidor. Verifique sua conexão.');
    }
    
    throw new Error(errorMessage);
  }

  if (!response.data) {
    throw new Error('Resposta inválida do servidor');
  }

  return response.data;
}

/**
 * Registra um novo usuário
 * @param data Dados de registro
 * @returns Resposta de autenticação com token e dados do usuário
 * @throws Error se os dados forem inválidos ou houver erro de rede
 */
export async function register(data: RegisterRequest): Promise<AuthResponse> {
  const response = await post<AuthResponse>('/api/auth/register', data);

  if (response.error) {
    const errorResponse = response.error as unknown as ErrorResponse;
    const errorMessage = errorResponse.message || 'Erro ao registrar usuário';
    
    // Verificar se é erro de rede
    if (response.status === 0 || errorResponse.error === 'NETWORK_ERROR') {
      throw new Error('Erro ao comunicar com o servidor. Verifique sua conexão.');
    }
    
    // Verificar se é email duplicado
    if (errorResponse.error === 'EMAIL_ALREADY_EXISTS' || errorMessage.includes('já está cadastrado') || errorMessage.includes('já existe')) {
      throw new Error('Este email já está cadastrado');
    }
    
    throw new Error(errorMessage);
  }

  if (!response.data) {
    throw new Error('Resposta inválida do servidor');
  }

  // Verificar se userType é "common" (FR-018a)
  if (response.data.user.userType !== 'common') {
    console.warn('Usuário registrado com userType diferente de "common":', response.data.user.userType);
  }

  return response.data;
}

/**
 * Valida a sessão atual com o backend
 * @returns Dados do usuário se a sessão é válida, null caso contrário
 */
export async function validateSession(): Promise<User | null> {
  try {
    const response = await get<User>('/api/auth/validate');
    
    if (response.error) {
      return null;
    }
    
    return response.data ?? null;
  } catch {
    return null;
  }
}
