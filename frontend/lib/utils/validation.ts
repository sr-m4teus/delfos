/**
 * Utilitários de validação para formulários
 * Baseado em data-model.md - regras de validação
 */

/**
 * Valida formato de email
 * @param email Email a ser validado
 * @returns true se o email é válido, false caso contrário
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Regex básico para validação de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Valida senha (mínimo 6 caracteres)
 * Baseado em contracts/api.yaml - regra mínima de validação
 * @param password Senha a ser validada
 * @returns true se a senha é válida, false caso contrário
 */
export function validatePassword(password: string): boolean {
  if (!password || typeof password !== 'string') {
    return false;
  }

  // Mínimo 6 caracteres (conforme contrato da API)
  return password.length >= 6;
}

/**
 * Valida nome completo (mínimo 2 caracteres, máximo 100 caracteres)
 * @param name Nome a ser validado
 * @returns true se o nome é válido, false caso contrário
 */
export function validateName(name: string): boolean {
  if (!name || typeof name !== 'string') {
    return false;
  }

  const trimmedName = name.trim();
  return trimmedName.length >= 2 && trimmedName.length <= 100;
}

/**
 * Valida confirmação de senha
 * @param password Senha original
 * @param passwordConfirmation Confirmação de senha
 * @returns true se as senhas coincidem, false caso contrário
 */
export function validatePasswordConfirmation(
  password: string,
  passwordConfirmation: string
): boolean {
  if (!password || !passwordConfirmation) {
    return false;
  }

  return password === passwordConfirmation;
}

/**
 * Valida dados de login
 * @param email Email do usuário
 * @param password Senha do usuário
 * @returns Objeto com resultado da validação e mensagens de erro
 */
export function validateLoginData(email: string, password: string): {
  isValid: boolean;
  errors: {
    email?: string;
    password?: string;
  };
} {
  const errors: { email?: string; password?: string } = {};

  if (!email || !validateEmail(email)) {
    errors.email = 'Email inválido';
  }

  if (!password || !validatePassword(password)) {
    errors.password = 'Senha deve ter no mínimo 6 caracteres';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Valida dados de registro
 * @param data Dados de registro
 * @returns Objeto com resultado da validação e mensagens de erro
 */
export function validateRegisterData(data: {
  email: string;
  password: string;
  passwordConfirmation: string;
  name: string;
}): {
  isValid: boolean;
  errors: {
    email?: string;
    password?: string;
    passwordConfirmation?: string;
    name?: string;
  };
} {
  const errors: {
    email?: string;
    password?: string;
    passwordConfirmation?: string;
    name?: string;
  } = {};

  if (!data.email || !validateEmail(data.email)) {
    errors.email = 'Email inválido';
  }

  if (!data.password || !validatePassword(data.password)) {
    errors.password = 'Senha deve ter no mínimo 6 caracteres';
  }

  if (
    !data.passwordConfirmation ||
    !validatePasswordConfirmation(data.password, data.passwordConfirmation)
  ) {
    errors.passwordConfirmation = 'As senhas não coincidem';
  }

  if (!data.name || !validateName(data.name)) {
    errors.name = 'Nome deve ter entre 2 e 100 caracteres';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
