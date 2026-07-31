/**
 * Componente Sidebar - Menu lateral colapsável
 * Menu fixo que aparece em todas as telas protegidas
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Layout, Menu, Button } from 'antd';
import type { MenuProps } from 'antd';
import {
  LeftOutlined,
  RightOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  HistoryOutlined,
  SettingOutlined,
  LogoutOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import Logo from './Logo';
import { useAuth } from '@/hooks/useAuth';
import styles from './Sidebar.module.css';

const { Sider } = Layout;

type MenuItem = Required<MenuProps>['items'][number];

interface SidebarProps {
  onCollapseChange?: (collapsed: boolean) => void;
}

/**
 * Componente Sidebar
 */
export function Sidebar({ onCollapseChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { logout, user } = useAuth();

  useEffect(() => {
    onCollapseChange?.(collapsed);
  }, [collapsed, onCollapseChange]);

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key === 'logout') {
      logout();
      router.push('/login');
      return;
    }
    router.push(key);
  };

  const menuItems: MenuItem[] = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: '/queries',
      icon: <MessageOutlined />,
      label: 'Consultas',
    },
    {
      key: '/databases',
      icon: <DatabaseOutlined />,
      label: 'Bancos de Dados',
    },
    {
      key: '/history',
      icon: <HistoryOutlined />,
      label: 'Histórico',
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: 'Configurações',
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Sair',
      danger: true,
    },
  ];

  // Determinar a chave ativa do menu baseado na rota atual
  const selectedKey = pathname || '/dashboard';

  return (
    <Sider
      trigger={null}
      collapsible
      collapsed={collapsed}
      className={styles.sider}
      width={250}
      collapsedWidth={80}
    >
      <div className={styles.logoContainer}>
        {!collapsed ? (
          <Logo size="small" />
        ) : (
          <div className={styles.logoCollapsed}>
            <span className={styles.logoLetter}>D</span>
          </div>
        )}
      </div>
      
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[selectedKey]}
        items={menuItems}
        onClick={handleMenuClick}
        className={styles.menu}
      />
      
      <div className={`${styles.toggleContainer} ${collapsed ? styles.toggleContainerCollapsed : ''}`}>
        <Button
          type="text"
          icon={collapsed ? <RightOutlined /> : <LeftOutlined />}
          onClick={() => setCollapsed(!collapsed)}
          className={styles.toggleButton}
          aria-label={collapsed ? 'Expandir menu' : 'Colapsar menu'}
        />
      </div>
    </Sider>
  );
}

export default Sidebar;
