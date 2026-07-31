/**
 * Componente Logo Delfos
 * Exibe a logo do sistema Delfos
 */

import styles from './Logo.module.css';

export interface LogoProps {
  className?: string;
  size?: 'small' | 'medium' | 'large';
}

/**
 * Componente Logo
 */
export function Logo({ className, size = 'medium' }: LogoProps) {
  return (
    <div className={`${styles.logo} ${styles[size]} ${className || ''}`}>
      <h1 className={styles.text}>delfos</h1>
    </div>
  );
}

export default Logo;
