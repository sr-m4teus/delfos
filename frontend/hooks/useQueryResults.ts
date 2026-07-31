/**
 * Hook para gerenciar resultados de queries com paginação
 */

import { useState, useEffect, useCallback } from 'react';
import { post } from '@/lib/api/client';
import type { QueryResultResponse, PaginationInfo } from '@/types/api';

interface UseQueryResultsOptions {
  sqlQuery: string;
  catalog?: string;
  schema?: string;
  initialPage?: number;
  initialPageSize?: number;
  autoFetch?: boolean;
}

interface UseQueryResultsReturn {
  data: Record<string, any>[] | undefined;
  columns: string[] | undefined;
  columnTypes: any[] | undefined;
  pagination: PaginationInfo | undefined;
  loading: boolean;
  error: string | null;
  executionTime: number | undefined;
  fetchResults: (page?: number, pageSize?: number) => Promise<void>;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  currentPage: number;
  currentPageSize: number;
}

export function useQueryResults({
  sqlQuery,
  catalog,
  schema,
  initialPage = 1,
  initialPageSize = 50,
  autoFetch = false,
}: UseQueryResultsOptions): UseQueryResultsReturn {
  const [data, setData] = useState<Record<string, any>[] | undefined>();
  const [columns, setColumns] = useState<string[] | undefined>();
  const [columnTypes, setColumnTypes] = useState<any[] | undefined>();
  const [pagination, setPagination] = useState<PaginationInfo | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executionTime, setExecutionTime] = useState<number | undefined>();
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [currentPageSize, setCurrentPageSize] = useState(initialPageSize);

  const fetchResults = useCallback(
    async (page?: number, pageSize?: number) => {
      if (!sqlQuery.trim()) {
        return;
      }

      setLoading(true);
      setError(null);

      const pageToUse = page ?? currentPage;
      const pageSizeToUse = pageSize ?? currentPageSize;

      try {
        const response = await post<QueryResultResponse>('/api/delfos/execute', {
          sql_query: sqlQuery,
          catalog,
          schema,
          page: pageToUse,
          pageSize: pageSizeToUse,
        });

        if (response.error) {
          setError(response.error.message || 'Erro ao executar query');
          setData(undefined);
          setColumns(undefined);
          setColumnTypes(undefined);
          setPagination(undefined);
          setExecutionTime(undefined);
        } else if (response.data) {
          if (response.data.success === false) {
            setError(
              response.data.error || 'Erro ao executar query no servidor',
            );
            setData(undefined);
            setColumns(undefined);
            setColumnTypes(undefined);
            setPagination(undefined);
            setExecutionTime(undefined);
          } else {
            setData(response.data.data);
            setColumns(response.data.columns);
            setColumnTypes(response.data.column_types);
            setPagination(response.data.pagination);
            setExecutionTime(response.data.execution_time_ms);
            setCurrentPage(pageToUse);
            setCurrentPageSize(pageSizeToUse);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido ao executar query');
        setData(undefined);
        setColumns(undefined);
        setColumnTypes(undefined);
        setPagination(undefined);
        setExecutionTime(undefined);
      } finally {
        setLoading(false);
      }
    },
    [sqlQuery, catalog, schema, currentPage, currentPageSize],
  );

  const setPage = useCallback(
    (page: number) => {
      setCurrentPage(page);
      fetchResults(page, currentPageSize);
    },
    [currentPageSize, fetchResults],
  );

  const setPageSize = useCallback(
    (pageSize: number) => {
      setCurrentPageSize(pageSize);
      fetchResults(1, pageSize); // Resetar para primeira página ao mudar tamanho
    },
    [fetchResults],
  );

  useEffect(() => {
    if (autoFetch && sqlQuery.trim()) {
      fetchResults();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch, sqlQuery]);

  return {
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
    currentPage,
    currentPageSize,
  };
}
