/**
 * Gerenciador de tokens JWT com validação
 * Baseado em research.md - validação de JWT no cliente antes de requisições
 */

import {
  decodeToken,
  isTokenExpired,
  isValidTokenFormat,
  validateToken,
  extractUserFromToken,
} from '@/lib/utils/jwt-utils';
import { getToken, removeToken } from '@/lib/auth/session-storage';
import type { DecodedTokenResult, ExtractedUserResult } from '@/types/auth';

/**
 * Obtém o token armazenado e valida se está válido
 * @returns Token válido ou null se não encontrado ou inválido
 */
export function getStoredToken(): string | null {
  const token = getToken();
  if (!token) {
    return null;
  }

  if (!validateToken(token)) {
    // Token inválido ou expirado, remove do storage
    removeToken();
    return null;
  }

  return token;
}

/**
 * Valida o token armazenado
 * @returns true se o token é válido e não está expirado, false caso contrário
 */
export function validateStoredToken(): boolean {
  const token = getStoredToken();
  return token !== null;
}

/**
 * Limpa o token armazenado
 */
export function clearStoredToken(): void {
  removeToken();
}

/**
 * Obtém o payload do token armazenado
 * @returns Payload do token ou null se não encontrado ou inválido
 */
export function getTokenPayload(): DecodedTokenResult {
  const token = getStoredToken();
  if (!token) {
    return null;
  }

  return decodeToken(token);
}

/**
 * Verifica se o token armazenado está expirado
 * @returns true se o token está expirado ou não existe, false caso contrário
 */
export function isStoredTokenExpired(): boolean {
  const token = getToken();
  if (!token) {
    return true;
  }

  return isTokenExpired(token);
}

/**
 * Extrai dados do usuário do token armazenado
 * @returns Dados do usuário ou null se não encontrado ou inválido
 */
export function getUserFromStoredToken(): ExtractedUserResult {
  const token = getStoredToken();
  if (!token) {
    return null;
  }

  return extractUserFromToken(token);
}

/**
 * Valida token antes de usar em requisições
 * Remove automaticamente se inválido ou expirado
 * @param token Token a ser validado
 * @returns true se válido, false caso contrário
 */
export function validateTokenBeforeRequest(token: string | null): boolean {
  if (!token) {
    return false;
  }

  if (!isValidTokenFormat(token)) {
    clearStoredToken();
    return false;
  }

  if (isTokenExpired(token)) {
    clearStoredToken();
    return false;
  }

  return true;
}
