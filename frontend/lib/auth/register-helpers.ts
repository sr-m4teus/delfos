/**
 * Helpers para formulário de registro
 * Lógica reutilizável para submissão e tratamento de erros
 */

import { validateRegisterData } from '@/lib/utils/validation';
import type { RegisterRequest } from '@/types/auth';

export interface RegisterFormErrors {
  email?: string;
  password?: string;
  passwordConfirmation?: string;
  name?: string;
}

export interface RegisterSubmitResult {
  isValid: boolean;
  errors: RegisterFormErrors;
}

/**
 * Valida dados do formulário de registro antes de enviar
 * @param values Valores do formulário
 * @returns Resultado da validação com erros se houver
 */
export function validateRegisterForm(values: RegisterRequest): RegisterSubmitResult {
  const validation = validateRegisterData({
    email: values.email,
    password: values.password,
    passwordConfirmation: values.passwordConfirmation,
    name: values.name,
  });

  return {
    isValid: validation.isValid,
    errors: validation.errors,
  };
}

/**
 * Processa erro de registro e retorna erros formatados para o formulário
 * @param error Erro capturado
 * @returns Erros formatados para exibição no formulário ou mensagem genérica
 */
export function processRegisterError(error: unknown): {
  formErrors: RegisterFormErrors;
  genericError: string | null;
} {
  const errorMessage = error instanceof Error ? error.message : 'Erro ao registrar usuário';
  
  // Verificar se é erro de rede/backend indisponível
  if (
    errorMessage.includes('Erro ao comunicar') ||
    errorMessage.includes('network') ||
    errorMessage.includes('Network') ||
    errorMessage.includes('conexão')
  ) {
    return {
      formErrors: {},
      genericError: 'Serviço temporariamente indisponível. Por favor, tente novamente.',
    };
  }

  // Verificar se é email duplicado
  if (
    errorMessage.includes('já está cadastrado') ||
    errorMessage.includes('já existe') ||
    errorMessage.includes('EMAIL_ALREADY_EXISTS')
  ) {
    return {
      formErrors: { email: errorMessage },
      genericError: null,
    };
  }

  // Erro genérico
  return {
    formErrors: {},
    genericError: errorMessage,
  };
}
