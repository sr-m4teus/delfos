/**
 * Wrapper para o componente Input do Ant Design
 * Facilita eventual troca de biblioteca de UI
 */

'use client';

import { Input as AntInput, InputProps as AntInputProps } from 'antd';

export interface InputProps extends AntInputProps {
  // Props específicas podem ser adicionadas aqui no futuro
}

/**
 * Componente Input wrapper do Ant Design
 */
export function Input({ ...props }: InputProps) {
  return <AntInput {...props} />;
}

export default Input;
