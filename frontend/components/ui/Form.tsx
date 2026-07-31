/**
 * Wrapper para o componente Form do Ant Design
 * Facilita eventual troca de biblioteca de UI
 */

'use client';

import { Form as AntForm, FormProps as AntFormProps } from 'antd';
import type { ReactNode } from 'react';

export interface FormProps extends Omit<AntFormProps, 'children'> {
  children?: ReactNode;
  // Props específicas podem ser adicionadas aqui no futuro
}

/**
 * Componente Form wrapper do Ant Design
 */
export function Form({ children, ...props }: FormProps) {
  return <AntForm {...props}>{children}</AntForm>;
}

// Exportar também Form.Item para facilitar uso
export const FormItem = AntForm.Item;

export default Form;
