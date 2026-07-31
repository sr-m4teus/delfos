/**
 * Formulário de login
 * Client Component com validação e integração com useAuth
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Form, FormItem } from '@/components/ui/Form';
import { Input } from 'antd';
import { Button } from '@/components/ui/Button';

const { Password } = Input;
import { showError, showSuccess } from '@/components/ui/Message';
import { useAuth } from '@/hooks/useAuth';
import { validateLoginData } from '@/lib/utils/validation';
import type { LoginRequest } from '@/types/auth';

export function LoginForm() {
  const router = useRouter();
  const { login, isLoading, error, clearError } = useAuth();
  const [formErrors, setFormErrors] = useState<{ email?: string; password?: string }>({});

  const handleSubmit = async (values: LoginRequest) => {
    // Limpar erros anteriores
    clearError();
    setFormErrors({});

    // Validação no cliente
    const validation = validateLoginData(values.email, values.password);
    if (!validation.isValid) {
      setFormErrors(validation.errors);
      return;
    }

    try {
      await login(values);
      showSuccess('Login realizado com sucesso!');
      router.push('/dashboard');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao fazer login';
      
      // Verificar se é erro de rede/backend indisponível
      if (errorMessage.includes('Erro ao comunicar') || errorMessage.includes('network') || errorMessage.includes('Network')) {
        showError('Serviço temporariamente indisponível. Por favor, tente novamente.');
      } else {
        showError(errorMessage);
      }
    }
  };

  return (
    <Form
      name="login"
      onFinish={handleSubmit}
      layout="vertical"
      autoComplete="off"
    >
      <FormItem
        label="Email"
        name="email"
        rules={[
          { required: true, message: 'Email é obrigatório' },
          { type: 'email', message: 'Email inválido' },
        ]}
        validateStatus={formErrors.email ? 'error' : ''}
        help={formErrors.email}
      >
        <Input
          type="email"
          placeholder="seu@email.com"
          size="large"
        />
      </FormItem>

      <FormItem
        label="Senha"
        name="password"
        rules={[
          { required: true, message: 'Senha é obrigatória' },
        ]}
        validateStatus={formErrors.password ? 'error' : ''}
        help={formErrors.password}
      >
        <Password
          placeholder="Digite sua senha"
          size="large"
        />
      </FormItem>

      {error && (
        <FormItem>
          <div style={{ color: 'red', marginBottom: '16px' }}>
            {error}
          </div>
        </FormItem>
      )}

      <FormItem>
        <Button
          type="primary"
          htmlType="submit"
          size="large"
          block
          loading={isLoading}
        >
          Entrar
        </Button>
      </FormItem>
    </Form>
  );
}

export default LoginForm;
