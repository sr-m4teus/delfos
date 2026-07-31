/**
 * Wrapper para o componente Message do Ant Design
 * Facilita eventual troca de biblioteca de UI
 */

'use client';

import { message as antMessage, MessageArgsProps } from 'antd';

export type MessageType = 'success' | 'error' | 'info' | 'warning' | 'loading';

/**
 * Exibe uma mensagem de sucesso
 */
export function showSuccess(content: string, duration?: number) {
  antMessage.success(content, duration);
}

/**
 * Exibe uma mensagem de erro
 */
export function showError(content: string, duration?: number) {
  antMessage.error(content, duration);
}

/**
 * Exibe uma mensagem de informação
 */
export function showInfo(content: string, duration?: number) {
  antMessage.info(content, duration);
}

/**
 * Exibe uma mensagem de aviso
 */
export function showWarning(content: string, duration?: number) {
  antMessage.warning(content, duration);
}

/**
 * Exibe uma mensagem de loading
 */
export function showLoading(content: string, duration?: number) {
  antMessage.loading(content, duration);
}

/**
 * Função genérica para exibir mensagens
 */
export function showMessage(
  type: MessageType,
  content: string,
  duration?: number
) {
  antMessage[type](content, duration);
}

/**
 * Destrói todas as mensagens ativas
 */
export function destroyMessages() {
  antMessage.destroy();
}
