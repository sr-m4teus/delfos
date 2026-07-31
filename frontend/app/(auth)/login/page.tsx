/**
 * Página de login
 * Server Component que renderiza o formulário de login
 */

import LoginForm from '@/components/auth/LoginForm';
import Link from 'next/link';
import styles from './login.module.css';

export default function LoginPage() {
  // Nota: Verificação de autenticação será feita no middleware
  // Se já estiver autenticado, middleware redireciona para dashboard

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>
          Login
        </h1>
        <LoginForm />
        <div className={styles.linkContainer}>
          <Link href="/register" className={styles.link}>
            Não tem uma conta? Cadastre-se
          </Link>
        </div>
      </div>
    </div>
  );
}
