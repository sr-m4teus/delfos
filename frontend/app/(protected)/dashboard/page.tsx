/**
 * Página principal (Dashboard)
 * Estatísticas e consultas recentes a partir de /api/schemas e /api/delfos/query-history
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Row,
  Col,
  Card,
  Statistic,
  Table,
  Typography,
  Space,
  Spin,
  Empty,
  App,
} from 'antd';
import {
  DatabaseOutlined,
  FileSearchOutlined,
  CalendarOutlined,
  TableOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
} from '@ant-design/icons';
import { get } from '@/lib/api/client';
import type {
  ListSchemasResponse,
  QueryHistoryItem,
  QueryHistoryListResponse,
  SchemaDatabaseSummary,
} from '@/types/api';
import styles from './dashboard.module.css';

const { Title } = Typography;

const HISTORY_LIMIT = 500;

function formatValidatedAt(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function countTables(databases: SchemaDatabaseSummary[]): number {
  return databases.reduce((acc, db) => acc + db.tables.length, 0);
}

function formatCatalogLabel(item: QueryHistoryItem): string {
  const parts = [item.catalog, item.schema].filter(Boolean);
  if (parts.length) return parts.join('.');
  if (item.tables?.length) return item.tables[0]!.split('.').slice(0, -1).join('.') || item.tables[0]!;
  return '—';
}

/** Variação percentual entre o mês atual e o mês anterior (com base em validated_at). */
function monthOverMonthGrowthPercent(items: QueryHistoryItem[]): {
  percent: number | null;
  current: number;
  previous: number;
} {
  const now = new Date();
  const curM = now.getMonth();
  const curY = now.getFullYear();
  const prevM = curM === 0 ? 11 : curM - 1;
  const prevY = curM === 0 ? curY - 1 : curY;

  let current = 0;
  let previous = 0;
  for (const item of items) {
    const d = new Date(item.validated_at);
    if (Number.isNaN(d.getTime())) continue;
    if (d.getFullYear() === curY && d.getMonth() === curM) current++;
    else if (d.getFullYear() === prevY && d.getMonth() === prevM) previous++;
  }

  if (previous === 0 && current === 0) return { percent: null, current, previous };
  if (previous === 0) return { percent: null, current, previous };
  return { percent: ((current - previous) / previous) * 100, current, previous };
}

function queriesLastDays(items: QueryHistoryItem[], days: number): number {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return items.filter((item) => {
    const t = new Date(item.validated_at).getTime();
    return !Number.isNaN(t) && t >= cutoff;
  }).length;
}

const columns = [
  {
    title: 'Consulta',
    dataIndex: 'query',
    key: 'query',
    ellipsis: true,
    width: '40%',
  },
  {
    title: 'Catálogo / contexto',
    dataIndex: 'database',
    key: 'database',
    width: '25%',
    ellipsis: true,
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    width: '15%',
    render: (status: string) => {
      const statusConfig = {
        success: { text: 'Sucesso', color: '#52c41a' },
        pending: { text: 'Pendente', color: '#faad14' },
        error: { text: 'Erro', color: '#ff4d4f' },
      };
      const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.success;
      return <span style={{ color: config.color }}>{config.text}</span>;
    },
  },
  {
    title: 'Tempo',
    dataIndex: 'executionTime',
    key: 'executionTime',
    width: '10%',
  },
  {
    title: 'Data/Hora',
    dataIndex: 'timestamp',
    key: 'timestamp',
    width: '20%',
  },
];

export default function DashboardPage() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [databaseCount, setDatabaseCount] = useState(0);
  const [tableCount, setTableCount] = useState(0);
  const [historyItems, setHistoryItems] = useState<QueryHistoryItem[]>([]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    const [schemasRes, historyRes] = await Promise.all([
      get<ListSchemasResponse>('/api/schemas'),
      get<QueryHistoryListResponse>(`/api/delfos/query-history?limit=${HISTORY_LIMIT}`),
    ]);

    if (schemasRes.error) {
      message.error(schemasRes.error.message || 'Erro ao carregar schemas');
      setDatabaseCount(0);
      setTableCount(0);
    } else {
      const dbs = schemasRes.data?.databases ?? [];
      setDatabaseCount(dbs.length);
      setTableCount(countTables(dbs));
    }

    if (historyRes.error) {
      message.error(historyRes.error.message || 'Erro ao carregar histórico');
      setHistoryItems([]);
    } else {
      setHistoryItems(historyRes.data?.items ?? []);
    }

    setLoading(false);
  }, [message]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const totalQueries = historyItems.length;
  const last7d = useMemo(() => queriesLastDays(historyItems, 7), [historyItems]);
  const mom = useMemo(() => monthOverMonthGrowthPercent(historyItems), [historyItems]);

  const recentRows = useMemo(() => {
    return [...historyItems]
      .sort((a, b) => new Date(b.validated_at).getTime() - new Date(a.validated_at).getTime())
      .slice(0, 10)
      .map((item) => ({
        key: item.id,
        query:
          item.natural_language_query?.trim() ||
          item.sql_query?.substring(0, 120) ||
          '—',
        database: formatCatalogLabel(item),
        status: 'success' as const,
        executionTime: '—',
        timestamp: formatValidatedAt(item.validated_at),
      }));
  }, [historyItems]);

  if (loading) {
    return (
      <div className={`${styles.container} ${styles.loadingWrap}`}>
        <Spin size="large" tip="Carregando dashboard..." />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <Title level={2}>Dashboard</Title>

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Bancos de dados"
                value={databaseCount}
                prefix={<DatabaseOutlined />}
                valueRender={(node) => <span style={{ color: '#1890ff' }}>{node}</span>}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Consultas no histórico"
                value={totalQueries}
                prefix={<FileSearchOutlined />}
                valueRender={(node) => <span style={{ color: '#722ed1' }}>{node}</span>}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Últimos 7 dias"
                value={last7d}
                prefix={<CalendarOutlined />}
                valueRender={(node) => <span style={{ color: '#52c41a' }}>{node}</span>}
                suffix={<span style={{ fontSize: 12, color: '#666' }}>consulta(s)</span>}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Tabelas mapeadas"
                value={tableCount}
                prefix={<TableOutlined />}
                valueRender={(node) => <span style={{ color: '#faad14' }}>{node}</span>}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title="Crescimento de consultas (mês atual vs. anterior)" className={styles.chartCard}>
              <div className={styles.chartPlaceholder}>
                {mom.percent !== null ? (
                  <>
                    <Statistic
                      title="Variação"
                      value={Math.abs(mom.percent)}
                      precision={1}
                      valueRender={(node) => (
                        <span style={{ color: mom.percent! >= 0 ? '#3f8600' : '#cf1322' }}>{node}</span>
                      )}
                      prefix={mom.percent >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                      suffix="%"
                    />
                    <p style={{ marginTop: 16, color: '#666' }}>
                      {mom.current} consulta(s) este mês · {mom.previous} no mês anterior (amostra até{' '}
                      {HISTORY_LIMIT} registros)
                    </p>
                  </>
                ) : mom.current > 0 && mom.previous === 0 ? (
                  <>
                    <Statistic
                      title="Mês atual"
                      value={mom.current}
                      prefix={<ArrowUpOutlined style={{ color: '#3f8600' }} />}
                      suffix="consulta(s)"
                    />
                    <p style={{ marginTop: 16, color: '#666' }}>
                      Sem registros no mês anterior para comparar.
                    </p>
                  </>
                ) : (
                  <>
                    <Statistic
                      title="Variação"
                      value={0}
                      prefix={<MinusOutlined />}
                      suffix="%"
                    />
                    <p style={{ marginTop: 16, color: '#666' }}>
                      Dados insuficientes no histórico para calcular a variação mês a mês.
                    </p>
                  </>
                )}
              </div>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="Histórico RAG" className={styles.chartCard}>
              <div className={styles.chartPlaceholder}>
                <Statistic
                  title="Consultas validadas na amostra"
                  value={totalQueries}
                  suffix={totalQueries > 0 ? <span style={{ fontSize: 14, color: '#52c41a' }}> (100% sucesso)</span> : null}
                  valueRender={(node) => <span style={{ color: '#722ed1' }}>{node}</span>}
                />
                <p style={{ marginTop: 16, color: '#666' }}>
                  O backend só persiste no histórico consultas executadas e validadas com sucesso (até{' '}
                  {HISTORY_LIMIT} entradas para este painel).
                </p>
              </div>
            </Card>
          </Col>
        </Row>

        <Card title="Consultas recentes">
          {recentRows.length === 0 ? (
            <Empty description="Nenhuma consulta no histórico ainda" />
          ) : (
            <Table
              columns={columns}
              dataSource={recentRows}
              pagination={{ pageSize: 10 }}
              size="middle"
            />
          )}
        </Card>
      </Space>
    </div>
  );
}
