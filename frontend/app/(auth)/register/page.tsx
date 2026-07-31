/**
 * Página de registro
 * Server Component que renderiza o formulário de registro
 */

import RegisterForm from '@/components/auth/RegisterForm';
import Link from 'next/link';
import styles from './register.module.css';

export default function RegisterPage() {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>
          Criar Conta
        </h1>
        <RegisterForm />
        <div className={styles.linkContainer}>
          <Link href="/login" className={styles.link}>
            Já tem uma conta? Faça login
          </Link>
        </div>
      </div>
    </div>
  );
}
