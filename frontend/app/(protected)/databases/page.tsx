'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Typography, Spin, Alert } from 'antd';
import { applyNodeChanges, type Node, type Edge, type OnNodesChange } from 'reactflow';
import { get } from '@/lib/api/client';
import type {
  ListSchemasResponse,
  SchemaDatabaseSummary,
} from '@/types/api';
import type { TableCardNodeData } from './TableCardNode';
import styles from './databases.module.css';

const SchemaDiagram = dynamic(() => import('./SchemaDiagram'), { ssr: false });

const { Title } = Typography;

const NODE_WIDTH = 240;
const NODE_HEIGHT = 160;
const PAD = 28;
const REGION_GAP = 80;
const COLS_PER_DB = 4;
const REGION_WIDTH = COLS_PER_DB * NODE_WIDTH + (COLS_PER_DB - 1) * PAD + PAD * 2;
const COLS_DATABASES = 2;

const DATABASE_COLORS = [
  '#1890ff',
  '#52c41a',
  '#faad14',
  '#f5222d',
  '#722ed1',
  '#13c2c2',
  '#eb2f96',
  '#fa8c16',
];

function getTableShortName(fullName: string): string {
  return (fullName.includes('.') ? fullName.split('.').pop() : fullName)?.toLowerCase() ?? '';
}

function inferEdgesSameDbOnly(
  databases: SchemaDatabaseSummary[],
  nodeIdToShort: Map<string, string>,
): Edge[] {
  const edges: Edge[] = [];

  databases.forEach((db) => {
    const shortNameToNodeIds = new Map<string, string[]>();
    db.tables.forEach((table) => {
      const id = `${db.database_id}::${table.name}`;
      const shortName = getTableShortName(table.name);
      if (!shortNameToNodeIds.has(shortName)) shortNameToNodeIds.set(shortName, []);
      shortNameToNodeIds.get(shortName)!.push(id);
    });

    const resolveTarget = (candidate: string): string | null => {
      const c = candidate.toLowerCase();
      const withS = c + 's';
      const withoutS = c.endsWith('s') ? c.slice(0, -1) : null;
      const ids = shortNameToNodeIds.get(c) ?? shortNameToNodeIds.get(withS) ?? (withoutS ? shortNameToNodeIds.get(withoutS) : null);
      return ids?.[0] ?? null;
    };

    db.tables.forEach((table) => {
      const sourceId = `${db.database_id}::${table.name}`;
      table.columns.forEach((col) => {
        if (!col.name.toLowerCase().endsWith('_id')) return;
        const candidate = col.name.slice(0, -3);
        if (!candidate) return;
        const targetId = resolveTarget(candidate);
        if (targetId && targetId !== sourceId) {
          const edgeId = `${sourceId}-${col.name}-${targetId}`;
          if (!edges.some((e) => e.id === edgeId)) {
            edges.push({
              id: edgeId,
              source: sourceId,
              target: targetId,
              type: 'smoothstep',
            });
          }
        }
      });
    });
  });

  return edges;
}

function buildNodesAndEdges(
  databases: SchemaDatabaseSummary[],
): { nodes: Node<TableCardNodeData>[]; edges: Edge[] } {
  const nodes: Node<TableCardNodeData>[] = [];
  const nodeIdToShort = new Map<string, string>();

  const colBottomY = [PAD, PAD];
  databases.forEach((db, dbIndex) => {
    const color = DATABASE_COLORS[dbIndex % DATABASE_COLORS.length];
    const dbCol = dbIndex % COLS_DATABASES;
    const offsetX = PAD + dbCol * (REGION_WIDTH + REGION_GAP);
    const rowsThisDb = Math.max(1, Math.ceil(db.tables.length / COLS_PER_DB));
    const regionHeightThisDb = rowsThisDb * NODE_HEIGHT + (rowsThisDb - 1) * PAD + PAD * 2;
    const offsetY = colBottomY[dbCol];
    colBottomY[dbCol] += regionHeightThisDb + REGION_GAP;

    db.tables.forEach((table, tableIndex) => {
      const col = tableIndex % COLS_PER_DB;
      const row = Math.floor(tableIndex / COLS_PER_DB);
      const x = offsetX + PAD + col * (NODE_WIDTH + PAD);
      const y = offsetY + PAD + row * (NODE_HEIGHT + PAD);

      const id = `${db.database_id}::${table.name}`;
      nodeIdToShort.set(id, getTableShortName(table.name));
      nodes.push({
        id,
        type: 'tableCard',
        position: { x, y },
        data: {
          databaseId: db.database_id,
          tableName: table.name,
          columns: table.columns,
          color,
        },
      });
    });
  });

  const edges = inferEdgesSameDbOnly(databases, nodeIdToShort);
  return { nodes, edges };
}

export default function DatabasesPage() {
  const [data, setData] = useState<ListSchemasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSchemas = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await get<ListSchemasResponse>('/api/schemas');
    if (res.error) {
      setError(res.error.message ?? 'Não foi possível carregar os schemas.');
      setData(null);
    } else if (res.data) {
      setData(res.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSchemas();
  }, [fetchSchemas]);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    if (!data?.databases?.length) return { nodes: [], edges: [] };
    return buildNodesAndEdges(data.databases);
  }, [data]);

  const [nodes, setNodes] = useState<Node<TableCardNodeData>[]>(initialNodes);
  const edges = initialEdges;

  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );

  if (loading) {
    return (
      <div className={styles.container}>
        <Title level={2}>Bancos de Dados</Title>
        <div className={styles.loadingWrap}>
          <Spin size="large" />
          <p className={styles.loadingText}>Carregando schemas do Trino...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <Title level={2}>Bancos de Dados</Title>
        <div className={styles.errorWrap}>
          <Alert
            type="error"
            message="Erro ao carregar schemas"
            description={error}
            showIcon
          />
        </div>
      </div>
    );
  }

  if (!data?.databases?.length) {
    return (
      <div className={styles.container}>
        <Title level={2}>Bancos de Dados</Title>
        <div className={styles.emptyWrap}>
          Nenhum banco ou tabela encontrado no Trino. Verifique a conexão e os catálogos.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Title level={2}>Bancos de Dados</Title>
      <p style={{ marginBottom: 16, color: '#666' }}>
        Tabelas agrupadas por banco. Arraste os cards para organizar. As linhas indicam relações dentro do mesmo banco (colunas <code>_id</code>).
      </p>
      <div className={styles.diagramWrap}>
        <SchemaDiagram
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
        />
      </div>
    </div>
  );
}
