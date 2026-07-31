/**
 * Componente de controles de paginação com seletor de tamanho de página
 */

'use client';

import { Pagination, Select, Space, Typography } from 'antd';
import type { PaginationInfo } from '@/types/api';
import styles from './PaginationControls.module.css';

const { Text } = Typography;
const { Option } = Select;

interface PaginationControlsProps {
  pagination: PaginationInfo;
  /** Linhas na página atual (para total sintético no Ant Design quando total_rows não veio na resposta). */
  pageRowCount?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  loading?: boolean;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100];

export default function PaginationControls({
  pagination,
  pageRowCount = 0,
  onPageChange,
  onPageSizeChange,
  loading = false,
}: PaginationControlsProps) {
  const { current_page, page_size, total_rows, has_more } = pagination;

  const totalKnown = total_rows != null && total_rows !== undefined;
  const hasMore = has_more === true;

  /**
   * Ant Design exige `total` numérico. Com has_more e total desconhecido, usamos um teto sintético
   * (página atual + uma página extra) para manter o botão "próxima" até a API retornar total exato.
   */
  const antdTotal = totalKnown
    ? total_rows
    : hasMore
      ? current_page * page_size + page_size
      : Math.max(
          0,
          (current_page - 1) * page_size + pageRowCount,
        );

  const startRow =
    antdTotal === 0 ? 0 : (current_page - 1) * page_size + 1;
  const endRow =
    totalKnown
      ? Math.min(current_page * page_size, total_rows!)
      : (current_page - 1) * page_size + pageRowCount;

  const totalLabel = totalKnown
    ? total_rows!.toLocaleString('pt-BR')
    : hasMore
      ? 'mais registros disponíveis'
      : antdTotal.toLocaleString('pt-BR');

  return (
    <div className={styles.paginationContainer}>
      <Space size="middle" align="center">
        <Text type="secondary">
          Mostrando {startRow}-{endRow}
          {totalKnown || !hasMore ? ` de ${totalLabel}` : ` — ${totalLabel}`}
        </Text>
        
        <Space size="small">
          <Text type="secondary">Registros por página:</Text>
          <Select
            value={page_size}
            onChange={onPageSizeChange}
            disabled={loading}
            style={{ width: 80 }}
          >
            {PAGE_SIZE_OPTIONS.map(size => (
              <Option key={size} value={size}>
                {size}
              </Option>
            ))}
          </Select>
        </Space>

        <Pagination
          current={current_page}
          total={antdTotal}
          pageSize={page_size}
          onChange={onPageChange}
          showSizeChanger={false}
          showQuickJumper
          showTotal={
            totalKnown
              ? (total, range) => `${range[0]}-${range[1]} de ${total}`
              : (total, range) =>
                  hasMore
                    ? `${range[0]}-${range[1]} (total parcial desconhecido)`
                    : `${range[0]}-${range[1]} de ${total}`
          }
          disabled={loading}
          className={styles.pagination}
        />
      </Space>
    </div>
  );
}
