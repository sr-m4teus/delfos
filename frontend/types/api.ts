/**
 * Tipos gerais de API e tratamento de erros
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: ApiError;
  status: number;
}

export type ApiClientConfig = {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
};

/**
 * Metadados de uma coluna de resultado
 */
export interface ColumnMetadata {
  name: string;
  type: string;
  typeSignature?: any;
}

/**
 * Informações de paginação (resultados Trino)
 */
export interface PaginationInfo {
  current_page: number;
  page_size: number;
  /** true quando o backend parou de ler o resultado antes do fim (total global desconhecido). */
  has_more?: boolean;
  /** Presente quando o resultado completo foi materializado no servidor. */
  total_rows?: number;
  total_pages?: number;
}

/**
 * Coluna em um schema de tabela (listagem)
 */
export interface SchemaColumnSummary {
  name: string;
  type: string;
}

/**
 * Tabela em um schema de banco (listagem)
 */
export interface SchemaTableSummary {
  name: string;
  columns: SchemaColumnSummary[];
}

/**
 * Banco/catálogo com suas tabelas (listagem)
 */
export interface SchemaDatabaseSummary {
  database_id: string;
  database_name?: string;
  tables: SchemaTableSummary[];
}

/**
 * Resposta do GET /api/schemas
 */
export interface ListSchemasResponse {
  databases: SchemaDatabaseSummary[];
}

/**
 * Resposta de execução de query com resultados paginados
 */
export interface QueryResultResponse {
  success: boolean;
  data?: Record<string, any>[];
  columns?: string[];
  column_types?: ColumnMetadata[];
  row_count?: number;
  pagination?: PaginationInfo;
  error?: string;
  execution_time_ms?: number;
  sql_query?: string;
}

/** Item do GET /api/delfos/query-history */
export interface QueryHistoryItem {
  id: string;
  natural_language_query: string;
  sql_query: string;
  validated_at: string;
  tables?: string[];
  catalog?: string;
  schema?: string;
}

export interface QueryHistoryListResponse {
  items: QueryHistoryItem[];
  total_returned: number;
}
