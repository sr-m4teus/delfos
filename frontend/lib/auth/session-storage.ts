/**
 * Gerenciador de armazenamento de sessão usando localStorage
 * Baseado em research.md - decisão de usar localStorage para persistência
 */

const TOKEN_KEY = process.env.NEXT_PUBLIC_TOKEN_STORAGE_KEY || 'delfos_auth_token';
const USER_KEY = process.env.NEXT_PUBLIC_USER_STORAGE_KEY || 'delfos_user_data';

/**
 * Salva o token JWT no localStorage
 * @param token Token JWT a ser salvo
 */
export function saveToken(token: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch (error) {
    console.error('Erro ao salvar token no localStorage:', error);
  }
}

/**
 * Obtém o token JWT do localStorage
 * @returns Token JWT ou null se não encontrado
 */
export function getToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch (error) {
    console.error('Erro ao obter token do localStorage:', error);
    return null;
  }
}

/**
 * Remove o token JWT do localStorage
 */
export function removeToken(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (error) {
    console.error('Erro ao remover token do localStorage:', error);
  }
}

/**
 * Salva dados do usuário no localStorage
 * @param user Dados do usuário a serem salvos
 */
export function saveUser(user: unknown): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (error) {
    console.error('Erro ao salvar dados do usuário no localStorage:', error);
  }
}

/**
 * Obtém dados do usuário do localStorage
 * @returns Dados do usuário ou null se não encontrado
 */
export function getUser<T = unknown>(): T | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const userData = localStorage.getItem(USER_KEY);
    return userData ? (JSON.parse(userData) as T) : null;
  } catch (error) {
    console.error('Erro ao obter dados do usuário do localStorage:', error);
    return null;
  }
}

/**
 * Remove dados do usuário do localStorage
 */
export function removeUser(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(USER_KEY);
  } catch (error) {
    console.error('Erro ao remover dados do usuário do localStorage:', error);
  }
}

/**
 * Limpa toda a sessão (token e dados do usuário)
 */
export function clearSession(): void {
  removeToken();
  removeUser();
}

/**
 * Verifica se existe uma sessão salva
 * @returns true se existe token salvo, false caso contrário
 */
export function hasSession(): boolean {
  return getToken() !== null;
}
