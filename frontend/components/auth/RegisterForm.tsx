/**
 * Formulário de registro
 * Client Component com validação e integração com useAuth
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Form, FormItem } from '@/components/ui/Form';
import { Input } from 'antd';
import { Button } from '@/components/ui/Button';
import { showError, showSuccess } from '@/components/ui/Message';
import { useAuth } from '@/hooks/useAuth';
import { validateRegisterForm, processRegisterError } from '@/lib/auth/register-helpers';
import type { RegisterRequest } from '@/types/auth';

const { Password } = Input;

export function RegisterForm() {
  const router = useRouter();
  const { register, isLoading, error, clearError } = useAuth();
  const [formErrors, setFormErrors] = useState<{
    email?: string;
    password?: string;
    passwordConfirmation?: string;
    name?: string;
  }>({});

  const handleSubmit = async (values: RegisterRequest) => {
    // Limpar erros anteriores
    clearError();
    setFormErrors({});

    // Validação no cliente
    const validation = validateRegisterForm(values);
    if (!validation.isValid) {
      setFormErrors(validation.errors);
      return;
    }

    try {
      await register(values);
      showSuccess('Registro realizado com sucesso!');
      router.push('/dashboard');
    } catch (err) {
      const { formErrors: processedErrors, genericError } = processRegisterError(err);
      
      if (Object.keys(processedErrors).length > 0) {
        setFormErrors(processedErrors);
      }
      
      if (genericError) {
        showError(genericError);
      }
    }
  };

  return (
    <Form
      name="register"
      onFinish={handleSubmit}
      layout="vertical"
      autoComplete="off"
    >
      <FormItem
        label="Nome completo"
        name="name"
        rules={[
          { required: true, message: 'Nome é obrigatório' },
          { min: 2, message: 'Nome deve ter no mínimo 2 caracteres' },
          { max: 100, message: 'Nome deve ter no máximo 100 caracteres' },
        ]}
        validateStatus={formErrors.name ? 'error' : ''}
        help={formErrors.name}
      >
        <Input
          placeholder="Seu nome completo"
          size="large"
        />
      </FormItem>

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
          { min: 6, message: 'Senha deve ter no mínimo 6 caracteres' },
        ]}
        validateStatus={formErrors.password ? 'error' : ''}
        help={formErrors.password}
      >
        <Password
          placeholder="Digite sua senha"
          size="large"
        />
      </FormItem>

      <FormItem
        label="Confirmar senha"
        name="passwordConfirmation"
        rules={[
          { required: true, message: 'Confirmação de senha é obrigatória' },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue('password') === value) {
                return Promise.resolve();
              }
              return Promise.reject(new Error('As senhas não coincidem'));
            },
          }),
        ]}
        validateStatus={formErrors.passwordConfirmation ? 'error' : ''}
        help={formErrors.passwordConfirmation}
      >
        <Password
          placeholder="Confirme sua senha"
          size="large"
        />
      </FormItem>

      {error && !formErrors.email && (
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
          Cadastrar
        </Button>
      </FormItem>
    </Form>
  );
}

export default RegisterForm;
