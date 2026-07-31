/**
 * Tipos relacionados a autenticação do sistema Delfos
 * Baseado em data-model.md
 */

export type UserType = 'common' | 'db-manager' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  userType: UserType;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  token: string;
  user: User;
  expiresAt: number;
  createdAt: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  passwordConfirmation: string;
  name: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  expiresIn?: number;
}

export interface ErrorResponse {
  error: string;
  message: string;
  details?: Record<string, string[]>;
}

export interface JWTPayload {
  sub: string;
  email: string;
  userType: UserType;
  exp: number;
  iat: number;
}

/**
 * Resultado da decodificação de um token JWT
 */
export type DecodedTokenResult = JWTPayload | null;

/**
 * Dados do usuário extraídos de um token JWT
 */
export interface ExtractedUserData {
  id: string;
  email: string;
  userType: UserType;
}

/**
 * Resultado da extração de dados do usuário de um token
 */
export type ExtractedUserResult = ExtractedUserData | null;
