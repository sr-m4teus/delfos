'use client';

import { memo, type CSSProperties } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { SchemaColumnSummary } from '@/types/api';
import styles from './databases.module.css';

export interface TableCardNodeData {
  databaseId: string;
  tableName: string;
  columns: SchemaColumnSummary[];
  color?: string;
}

function TableCardNodeComponent({ data }: NodeProps<TableCardNodeData>) {
  const { databaseId, tableName, columns, color } = data;
  const shortName = tableName.includes('.') ? tableName.split('.').pop() : tableName;
  const cardStyle: CSSProperties | undefined = color
    ? {
        borderLeftWidth: 4,
        borderLeftStyle: 'solid' as const,
        borderLeftColor: color,
        backgroundColor: `${color}14`,
      }
    : undefined;

  return (
    <div className={styles.tableCard} style={cardStyle}>
      <Handle
        type="target"
        position={Position.Left}
        className={styles.handle}
        style={color ? { background: color } : undefined}
      />
      <div className={styles.tableCardHeader}>
        <span className={styles.tableCardDb}>{databaseId}</span>
        <span className={styles.tableCardName}>{shortName ?? tableName}</span>
      </div>
      <ul className={styles.tableCardColumns}>
        {columns.slice(0, 8).map((col) => (
          <li key={col.name} className={styles.columnRow}>
            <span className={styles.columnName}>{col.name}</span>
            <span className={styles.columnType}>{col.type}</span>
          </li>
        ))}
        {columns.length > 8 && (
          <li className={styles.columnRow}>+{columns.length - 8} colunas</li>
        )}
      </ul>
      <Handle
        type="source"
        position={Position.Right}
        className={styles.handle}
        style={color ? { background: color } : undefined}
      />
    </div>
  );
}

export const TableCardNode = memo(TableCardNodeComponent);
