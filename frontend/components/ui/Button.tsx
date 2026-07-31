/**
 * Wrapper para o componente Button do Ant Design
 * Facilita eventual troca de biblioteca de UI
 */

'use client';

import { Button as AntButton, ButtonProps as AntButtonProps } from 'antd';

export interface ButtonProps extends AntButtonProps {
  // Props específicas podem ser adicionadas aqui no futuro
}

/**
 * Componente Button wrapper do Ant Design
 */
export function Button({ children, ...props }: ButtonProps) {
  return <AntButton {...props}>{children}</AntButton>;
}

export default Button;
