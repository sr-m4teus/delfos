/**
 * Utilitários para validação e manipulação de tokens JWT
 * Baseado em research.md - uso de jwt-decode para validação no cliente
 */

import { jwtDecode } from 'jwt-decode';
import type { JWTPayload, DecodedTokenResult, ExtractedUserData, ExtractedUserResult } from '@/types/auth';

/**
 * Decodifica um token JWT e retorna o payload
 * @param token Token JWT a ser decodificado
 * @returns Payload do token ou null se inválido
 */
export function decodeToken(token: string): DecodedTokenResult {
  try {
    const decoded = jwtDecode<JWTPayload>(token);
    return decoded;
  } catch (error) {
    console.error('Erro ao decodificar token JWT:', error);
    return null;
  }
}

/**
 * Verifica se um token JWT está expirado
 * @param token Token JWT a ser verificado
 * @returns true se o token está expirado, false caso contrário
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeToken(token);
  if (!payload || !payload.exp) {
    return true;
  }

  // exp está em segundos (Unix timestamp), Date.now() está em milissegundos
  const expirationTime = payload.exp * 1000;
  const currentTime = Date.now();

  // Adiciona margem de 5 segundos para evitar problemas de sincronização
  return currentTime >= expirationTime - 5000;
}

/**
 * Extrai dados do usuário do token JWT
 * @param token Token JWT
 * @returns Dados do usuário extraídos do token ou null se inválido
 */
export function extractUserFromToken(token: string): ExtractedUserResult {
  const payload = decodeToken(token);
  if (!payload || !payload.sub || !payload.email || !payload.userType) {
    return null;
  }

  const userData: ExtractedUserData = {
    id: payload.sub,
    email: payload.email,
    userType: payload.userType,
  };

  return userData;
}

/**
 * Valida formato básico de um token JWT (3 partes separadas por ponto)
 * @param token Token a ser validado
 * @returns true se o formato é válido, false caso contrário
 */
export function isValidTokenFormat(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  const parts = token.split('.');
  return parts.length === 3;
}

/**
 * Valida completamente um token JWT (formato + expiração)
 * @param token Token a ser validado
 * @returns true se o token é válido e não está expirado, false caso contrário
 */
export function validateToken(token: string): boolean {
  if (!isValidTokenFormat(token)) {
    return false;
  }

  if (isTokenExpired(token)) {
    return false;
  }

  return true;
}
