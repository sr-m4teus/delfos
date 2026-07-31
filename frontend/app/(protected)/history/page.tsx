/**
 * Histórico de consultas em linguagem natural (RAG por usuário)
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Typography,
  Collapse,
  Button,
  Space,
  Spin,
  Empty,
  App,
  Tag,
} from 'antd';
import { ReloadOutlined, PlayCircleOutlined, EditOutlined, TableOutlined } from '@ant-design/icons';
import SqlEditModal from '@/components/queries/SqlEditModal';
import { get, post } from '@/lib/api/client';
import type { QueryHistoryItem, QueryHistoryListResponse, QueryResultResponse } from '@/types/api';
import styles from './history.module.css';

const { Title, Text } = Typography;

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

export default function HistoryPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [items, setItems] = useState<QueryHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSql, setModalSql] = useState('');
  const [modalNl, setModalNl] = useState('');

  const loadHistory = useCallback(async () => {
    setLoading(true);
    const res = await get<QueryHistoryListResponse>('/api/delfos/query-history?limit=50');
    if (res.error) {
      message.error(res.error.message || 'Erro ao carregar histórico');
      setItems([]);
    } else {
      setItems(res.data?.items ?? []);
    }
    setLoading(false);
  }, [message]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const runExecute = async (sql: string, naturalLanguageQuery: string, afterSuccess?: () => void) => {
    const executeResponse = await post<QueryResultResponse>('/api/delfos/execute', {
      sql_query: sql,
      natural_language_query: naturalLanguageQuery,
    });

    if (executeResponse.error) {
      throw new Error(executeResponse.error.message || 'Erro ao executar consulta');
    }

    const result = executeResponse.data;
    if (!result || !result.success) {
      throw new Error(result?.error || 'Erro ao executar consulta');
    }

    setModalOpen(false);

    message.success('Consulta executada com sucesso.');

    if (result.data && result.data.length > 0) {
      sessionStorage.setItem(
        'queryResult',
        JSON.stringify({
          sqlQuery: sql,
          catalog: undefined,
          schema: undefined,
        }),
      );
      router.push('/results');
    } else {
      message.info('Consulta executada com sucesso, mas não retornou resultados.');
    }

    afterSuccess?.();
  };

  const handleExecuteRow = async (item: QueryHistoryItem) => {
    setExecutingId(item.id);
    try {
      await runExecute(item.sql_query, item.natural_language_query, () => loadHistory());
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao executar consulta');
    } finally {
      setExecutingId(null);
    }
  };

  const handleViewResults = (item: QueryHistoryItem) => {
    sessionStorage.setItem(
      'queryResult',
      JSON.stringify({
        sqlQuery: item.sql_query,
        catalog: item.catalog,
        schema: item.schema,
      }),
    );
    router.push('/results');
  };

  const openEdit = (item: QueryHistoryItem) => {
    setModalSql(item.sql_query);
    setModalNl(item.natural_language_query);
    setModalOpen(true);
  };

  const handleModalValidate = async (sql: string) => {
    await runExecute(sql, modalNl, () => {
      loadHistory();
    });
  };

  if (loading && items.length === 0) {
    return (
      <div className={styles.emptyWrap}>
        <Spin size="large" tip="Carregando histórico..." />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <Title level={2} style={{ margin: 0 }}>
          Histórico de consultas
        </Title>
        <Button icon={<ReloadOutlined />} onClick={() => loadHistory()} loading={loading}>
          Atualizar
        </Button>
      </div>

      <Text type="secondary">
        Consultas executadas com sucesso ficam salvas para contexto nas próximas perguntas e aparecem
        aqui.
      </Text>

      {items.length === 0 ? (
        <div className={styles.emptyWrap}>
          <Empty description="Nenhuma consulta no histórico ainda" />
        </div>
      ) : (
        <Collapse
          className={styles.collapse}
          bordered={false}
          items={items.map((item) => ({
            key: `${item.id}_${item.validated_at}`,
            label: (
              <div className={styles.panelLabel}>
                <span className={styles.panelTitle}>{item.natural_language_query}</span>
                <span className={styles.panelMeta}>{formatValidatedAt(item.validated_at)}</span>
              </div>
            ),
            children: (
              <div className={styles.panelBody}>
                {item.tables && item.tables.length > 0 && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Tabelas:{' '}
                    </Text>
                    {item.tables.map((t) => (
                      <Tag key={t} style={{ marginBottom: 4 }}>
                        {t}
                      </Tag>
                    ))}
                  </div>
                )}
                <pre className={styles.sqlCode}>{item.sql_query}</pre>
                <Space className={styles.actions} wrap>
                  <Button
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    loading={executingId === item.id}
                    onClick={() => handleExecuteRow(item)}
                  >
                    Executar
                  </Button>
                  <Button icon={<EditOutlined />} onClick={() => openEdit(item)}>
                    Editar SQL
                  </Button>
                  <Button icon={<TableOutlined />} onClick={() => handleViewResults(item)}>
                    Ver resultados
                  </Button>
                </Space>
              </div>
            ),
          }))}
        />
      )}

      <SqlEditModal
        open={modalOpen}
        sql={modalSql}
        onCancel={() => setModalOpen(false)}
        onValidate={handleModalValidate}
      />
    </div>
  );
}
