/**
 * Cliente HTTP configurado usando Axios
 * Baseado em research.md - decisão de usar Axios com interceptors
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import type { ApiResponse } from '@/types/api';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Cliente Axios configurado com base URL e configurações padrão
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL,
  // Tradução NL→SQL: RAG + OpenRouter pode levar bem mais de 30s; timeout curto gera
  // "requisição cancelada" no cliente enquanto o Nest ainda processa com sucesso.
  timeout: 120000, // 2 minutos
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Wrapper para requisições GET
 */
export async function get<T = unknown>(
  url: string,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> {
  try {
    const response: AxiosResponse<T> = await apiClient.get(url, config);
    return {
      data: response.data,
      status: response.status,
    };
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Wrapper para requisições POST
 */
export async function post<T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> {
  try {
    const response: AxiosResponse<T> = await apiClient.post(url, data, config);
    return {
      data: response.data,
      status: response.status,
    };
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Wrapper para requisições PUT
 */
export async function put<T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> {
  try {
    const response: AxiosResponse<T> = await apiClient.put(url, data, config);
    return {
      data: response.data,
      status: response.status,
    };
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Wrapper para requisições DELETE
 */
export async function del<T = unknown>(
  url: string,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> {
  try {
    const response: AxiosResponse<T> = await apiClient.delete(url, config);
    return {
      data: response.data,
      status: response.status,
    };
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Trata erros da API e retorna formato padronizado
 */
function handleApiError<T = unknown>(error: unknown): ApiResponse<T> {
  if (axios.isAxiosError(error)) {
    const isTimeout =
      error.code === 'ECONNABORTED' ||
      (typeof error.message === 'string' &&
        error.message.toLowerCase().includes('timeout'));

    // Se não há resposta, é erro de rede ou timeout do cliente
    if (!error.response && error.request) {
      return {
        error: {
          code: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
          message: isTimeout
            ? 'Tempo limite da requisição esgotado. A tradução pode levar mais de um minuto; tente novamente ou aguarde o servidor concluir.'
            : 'Erro ao comunicar com o servidor. Verifique sua conexão.',
        },
        status: 0,
      };
    }

    const rawMsg = error.response?.data?.message;
    const normalizedMessage = Array.isArray(rawMsg)
      ? rawMsg.join(' ')
      : typeof rawMsg === 'string'
        ? rawMsg
        : undefined;

    return {
      error: {
        code: error.response?.status?.toString() || 'NETWORK_ERROR',
        message:
          normalizedMessage ||
          error.message ||
          'Erro ao comunicar com o servidor',
        details: error.response?.data?.details,
      },
      status: error.response?.status || 0,
    };
  }

  return {
    error: {
      code: 'UNKNOWN_ERROR',
      message: 'Erro desconhecido ao processar requisição',
    },
    status: 0,
  };
}

export default apiClient;
