/**
 * Componente de tabela dinâmica que suporta múltiplos tipos de dados
 */

'use client';

import { Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ColumnMetadata } from '@/types/api';
import {
  getColumnDataType,
  formatValue,
  getColumnWidth,
  getColumnAlign,
  type DataType,
} from '@/lib/utils/dataTypes';
import styles from './DynamicTable.module.css';

interface DynamicTableProps {
  data: Record<string, any>[];
  columns?: string[];
  columnTypes?: ColumnMetadata[];
  loading?: boolean;
}

export default function DynamicTable({
  data,
  columns,
  columnTypes,
  loading = false,
}: DynamicTableProps) {
  // Se não houver colunas definidas, inferir das chaves do primeiro registro
  const tableColumns = columns || (data.length > 0 ? Object.keys(data[0]) : []);

  // Criar definições de colunas para o Ant Design Table
  const antdColumns: ColumnsType<Record<string, any>> = tableColumns.map((colName) => {
    const dataType = getColumnDataType(colName, columnTypes);
    const width = getColumnWidth(dataType);
    const align = getColumnAlign(dataType);

    return {
      title: colName,
      dataIndex: colName,
      key: colName,
      width,
      align,
      ellipsis: dataType === 'string',
      render: (value: any) => {
        const formattedValue = formatValue(value, dataType);
        
        // Para strings longas, mostrar tooltip com valor completo
        if (dataType === 'string' && typeof value === 'string' && value.length > 50) {
          return (
            <Tooltip title={value} placement="topLeft">
              <span className={styles.truncatedText}>{formattedValue}</span>
            </Tooltip>
          );
        }
        
        // Para valores NULL, aplicar estilo especial
        if (value === null || value === undefined) {
          return <span className={styles.nullValue}>{formattedValue}</span>;
        }
        
        return formattedValue;
      },
    };
  });

  return (
    <div className={styles.tableContainer}>
      <Table
        columns={antdColumns}
        dataSource={data.map((row, index) => ({ ...row, key: index }))}
        loading={loading}
        scroll={{ x: 'max-content', y: 'calc(100vh - 300px)' }}
        pagination={false}
        size="middle"
        className={styles.dynamicTable}
      />
    </div>
  );
}
