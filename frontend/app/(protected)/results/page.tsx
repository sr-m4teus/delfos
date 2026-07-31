/**
 * Página de Resultados
 * Exibe resultados de consultas SQL em uma tabela dinâmica com paginação
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, Typography, Alert, Spin, Button, Space } from 'antd';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';

const { Text } = Typography;
import DynamicTable from '@/components/results/DynamicTable';
import PaginationControls from '@/components/results/PaginationControls';
import { useQueryResults } from '@/hooks/useQueryResults';
import styles from './results.module.css';

const { Title } = Typography;

export default function ResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sqlQuery, setSqlQuery] = useState<string>('');
  const [catalog, setCatalog] = useState<string | undefined>();
  const [schema, setSchema] = useState<string | undefined>();

  const {
    data,
    columns,
    columnTypes,
    pagination,
    loading,
    error,
    executionTime,
    fetchResults,
    setPage,
    setPageSize,
  } = useQueryResults({
    sqlQuery: sqlQuery || '',
    catalog,
    schema,
    initialPage: 1,
    initialPageSize: 50,
    autoFetch: false,
  });

  useEffect(() => {
    // Obter parâmetros da URL ou do state
    const queryFromUrl = searchParams.get('query');
    const catalogFromUrl = searchParams.get('catalog');
    const schemaFromUrl = searchParams.get('schema');

    if (queryFromUrl) {
      setSqlQuery(decodeURIComponent(queryFromUrl));
      if (catalogFromUrl) {
        setCatalog(decodeURIComponent(catalogFromUrl));
      }
      if (schemaFromUrl) {
        setSchema(decodeURIComponent(schemaFromUrl));
      }
    } else {
      // Tentar obter do sessionStorage (navegação via state)
      const storedQuery = sessionStorage.getItem('queryResult');
      if (storedQuery) {
        try {
          const parsed = JSON.parse(storedQuery);
          setSqlQuery(parsed.sqlQuery || '');
          setCatalog(parsed.catalog);
          setSchema(parsed.schema);
          sessionStorage.removeItem('queryResult'); // Limpar após uso
        } catch (e) {
          console.error('Erro ao parsear query do sessionStorage:', e);
        }
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (sqlQuery) {
      // Sempre solicitar paginação para evitar carregar muitos dados
      fetchResults(1, 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sqlQuery]);

  const handleBack = () => {
    router.push('/queries');
  };

  const handleRefresh = () => {
    if (sqlQuery) {
      fetchResults();
    }
  };

  if (!sqlQuery) {
    return (
      <div className={styles.container}>
        <Card>
          <Alert
            title="Nenhuma consulta encontrada"
            description="Por favor, execute uma consulta na página de consultas para ver os resultados."
            type="warning"
            showIcon
            action={
              <Button type="primary" onClick={handleBack}>
                Voltar para Consultas
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div className={styles.header}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
              Voltar
            </Button>
            <Title level={2} style={{ margin: 0 }}>
              Resultados da Consulta
            </Title>
          </Space>
          {executionTime !== undefined && (
            <Typography.Text type="secondary">
              Tempo de execução: {(executionTime / 1000).toFixed(3)}s
            </Typography.Text>
          )}
        </div>

        <Card>
          <div className={styles.sqlQueryContainer}>
            <Typography.Text code className={styles.sqlQuery}>
              {sqlQuery}
            </Typography.Text>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              loading={loading}
            >
              Atualizar
            </Button>
          </div>
        </Card>

        {error && (
          <Alert
            title="Erro ao executar consulta"
            description={error}
            type="error"
            showIcon
            closable
          />
        )}

        {loading && !data && (
          <Card>
            <div className={styles.loadingContainer}>
              <Spin size="large" />
              <Text type="secondary" style={{ marginTop: 16 }}>
                Carregando resultados...
              </Text>
            </div>
          </Card>
        )}

        {!loading && data && data.length === 0 && (
          <Card>
            <Alert
              title="Nenhum resultado encontrado"
              description="A consulta foi executada com sucesso, mas não retornou nenhum registro."
              type="info"
              showIcon
            />
          </Card>
        )}

        {!loading && data && data.length > 0 && (
          <>
            <Card>
              <DynamicTable
                data={data}
                columns={columns}
                columnTypes={columnTypes}
                loading={loading}
              />
            </Card>

            {pagination && (
              <Card>
                <PaginationControls
                  pagination={pagination}
                  pageRowCount={data.length}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  loading={loading}
                />
              </Card>
            )}
          </>
        )}
      </Space>
    </div>
  );
}
