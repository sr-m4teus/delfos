/**
 * Layout para rotas protegidas
 * Verifica autenticação antes de renderizar children
 * Inclui Sidebar fixa em todas as telas protegidas
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Layout } from 'antd';
import { useAuth } from '@/hooks/useAuth';
import Sidebar from '@/components/layout/Sidebar';
import styles from './layout.module.css';

const { Content } = Layout;

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, isLoading, checkSession } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const verifyAuth = async () => {
      if (!isLoading) {
        const isValid = await checkSession();
        if (!isValid && !isAuthenticated) {
          router.push('/login');
        }
      }
    };

    verifyAuth();
  }, [isAuthenticated, isLoading, checkSession, router]);

  // Mostrar loading enquanto verifica autenticação
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <p>Carregando...</p>
      </div>
    );
  }

  // Se não autenticado, não renderiza (será redirecionado)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <Layout className={styles.layout}>
      <Sidebar onCollapseChange={setSidebarCollapsed} />
      <Layout 
        className={styles.contentLayout}
        style={{ marginLeft: sidebarCollapsed ? 80 : 250 }}
      >
        <Content className={styles.content}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
