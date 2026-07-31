import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { TrinoClientService } from '../../trino/services/trino-client.service';
import { RagOrchestratorClientService } from './rag-orchestrator-client.service';
import { TableNode } from '../entities/table-node.entity';
import { TableFkEdge } from '../entities/table-fk-edge.entity';
import {
  SyncSchemasResponseDto,
  SyncedCatalogDto,
  SyncSchemaErrorDto,
} from '../dto/sync-schemas-response.dto';
import {
  ListSchemasResponseDto,
  ListSchemasDatabaseDto,
  ListSchemasTableDto,
  ListSchemasColumnDto,
} from '../dto/list-schemas-response.dto';
import {
  RagRegisterSchemaRequestDto,
  RagSchemaTableDto,
  RagSchemaColumnDto,
  RagFkRefDto,
} from '../dto/rag-register-schema.dto';
import { getTableDescription } from '../config/table-glossary';

const INTERNAL_CATALOGS = new Set(['system', 'runtime', 'jmx', 'tpch', 'tpcds']);

// Schemas internos (Postgres + Supabase) que NÃO devem ir pro RAG.
// No Supabase a database `postgres` traz vários schemas de sistema além dos de negócio (db_*).
const SYSTEM_SCHEMAS = new Set([
  'pg_catalog',
  'information_schema',
  'public', // vazio no projeto de targets (negócio fica em db_*)
  'auth',
  'storage',
  'realtime',
  '_realtime',
  'graphql',
  'graphql_public',
  'extensions',
  'vault',
  'pgsodium',
  'pgsodium_masks',
  'supabase_functions',
  'supabase_migrations',
  'cron',
  'net',
  'pgbouncer',
]);

function isSystemSchema(schema: string): boolean {
  return SYSTEM_SCHEMAS.has(schema.trim().toLowerCase());
}

interface FkEdge {
  src_schema: string;
  src_table: string;
  src_column: string;
  ref_schema: string;
  ref_table: string;
  ref_column: string;
}

@Injectable()
export class SchemaSyncService {
  private readonly logger = new Logger(SchemaSyncService.name);

  constructor(
    private readonly trinoClient: TrinoClientService,
    private readonly ragClient: RagOrchestratorClientService,
    private readonly dataSource: DataSource,
    @InjectRepository(TableNode)
    private readonly nodeRepo: Repository<TableNode>,
    @InjectRepository(TableFkEdge)
    private readonly edgeRepo: Repository<TableFkEdge>,
  ) {}

  /**
   * Persiste nós (todas as tabelas do catálogo) e arestas FK no Postgres,
   * para consulta pelo endpoint de grafo de dependências. Delete-then-insert
   * por catálogo (idempotente; remove tabelas/FKs que deixaram de existir).
   * Falha aqui NÃO interrompe o sync do RAG.
   */
  async persistDependencyGraph(
    catalog: string,
    tables: RagSchemaTableDto[],
    edges: FkEdge[],
  ): Promise<void> {
    const nodes: TableNode[] = tables.map((t) => {
      // t.name = "schema.table"
      const dot = t.name.indexOf('.');
      const schemaName = dot >= 0 ? t.name.slice(0, dot) : '';
      const tableName = dot >= 0 ? t.name.slice(dot + 1) : t.name;
      return this.nodeRepo.create({
        fqn: `${catalog}.${t.name}`,
        catalog,
        schemaName,
        tableName,
      });
    });

    const edgeRows: TableFkEdge[] = edges.map((e) =>
      this.edgeRepo.create({
        srcFqn: `${catalog}.${e.src_schema}.${e.src_table}`,
        srcColumn: e.src_column,
        refFqn: `${catalog}.${e.ref_schema}.${e.ref_table}`,
        refColumn: e.ref_column,
        catalog,
      }),
    );

    try {
      await this.dataSource.transaction(async (manager) => {
        await manager.delete(TableNode, { catalog });
        await manager.delete(TableFkEdge, { catalog });
        if (nodes.length) await manager.save(nodes);
        if (edgeRows.length) await manager.save(edgeRows);
      });
      this.logger.log(
        `Catálogo ${catalog}: grafo persistido (${nodes.length} nós, ${edgeRows.length} arestas)`,
      );
    } catch (err: any) {
      this.logger.warn(
        `Catálogo ${catalog}: falha ao persistir grafo (não interrompe sync): ${err?.message ?? String(err)}`,
      );
    }
  }

  /**
   * Obtém a lista de catálogos do Trino (excluindo internos).
   */
  async getCatalogs(): Promise<string[]> {
    const result = await this.trinoClient.executeQuery({
      sql_query: 'SHOW CATALOGS',
      catalog: 'system',
      timeout: 15000,
    });

    if (!result.success || !result.data) {
      throw new Error(result.error ?? 'Falha ao listar catálogos do Trino');
    }

    const catalogColumn = result.columns?.[0] ?? 'Catalog';
    const catalogs = (result.data as Record<string, unknown>[])
      .map((row) => {
        const value = row[catalogColumn] ?? row['catalog'];
        return typeof value === 'string' ? value.trim() : String(value);
      })
      .filter((name) => name && !INTERNAL_CATALOGS.has(name.toLowerCase()));

    return catalogs;
  }

  /**
   * Coleta colunas do information_schema de um catálogo e monta o payload de schema para o RAG.
   * Também tenta extrair FKs via Trino passthrough (conector Postgres/MySQL); falha silenciosa
   * em conectores que não suportam (MongoDB, etc).
   */
  async collectCatalogSchema(catalog: string): Promise<RagSchemaTableDto[]> {
    const sql = `SELECT table_schema, table_name, column_name, data_type FROM information_schema.columns ORDER BY table_schema, table_name, ordinal_position`;
    const result = await this.trinoClient.executeQuery({
      sql_query: sql,
      catalog,
      timeout: 30000,
    });

    if (!result.success || !result.data) {
      if (result.error) {
        this.logger.warn(`Catálogo ${catalog}: ${result.error}`);
      }
      return [];
    }

    const rows = result.data as Record<string, unknown>[];
    const byTable = new Map<string, RagSchemaColumnDto[]>();

    for (const row of rows) {
      const tableSchema = this.getStr(row, 'table_schema');
      const tableName = this.getStr(row, 'table_name');
      const columnName = this.getStr(row, 'column_name');
      const dataType = this.getStr(row, 'data_type');

      if (!tableName || !columnName) continue;
      if (isSystemSchema(tableSchema)) continue; // pula schemas de sistema/Supabase

      const tableKey = `${tableSchema}.${tableName}`;
      if (!byTable.has(tableKey)) {
        byTable.set(tableKey, []);
      }
      byTable.get(tableKey)!.push({ name: columnName, type: dataType || 'unknown' });
    }

    const fkEdges = await this.collectCatalogForeignKeys(catalog);
    const fksByTable = new Map<string, RagFkRefDto[]>();
    for (const edge of fkEdges) {
      const tableKey = `${edge.src_schema}.${edge.src_table}`;
      if (!fksByTable.has(tableKey)) {
        fksByTable.set(tableKey, []);
      }
      fksByTable.get(tableKey)!.push({
        column: edge.src_column,
        ref_database_id: catalog,
        ref_schema: edge.ref_schema || undefined,
        ref_table: edge.ref_table,
        ref_column: edge.ref_column,
      });
    }

    const tables: RagSchemaTableDto[] = [];
    for (const [fullName, columns] of byTable.entries()) {
      const fks = fksByTable.get(fullName);
      const description = getTableDescription(catalog, fullName);
      tables.push({
        name: fullName,
        columns,
        ...(description ? { description } : {}),
        ...(fks && fks.length ? { foreign_keys: fks } : {}),
      });
    }

    return tables;
  }

  /**
   * Extrai FKs via Trino passthrough no conector Postgres/MySQL.
   * Usa TABLE("catalog".system.query(query => ...)) para rodar SQL nativo no DB source.
   * Retorna [] se conector não suporta (MongoDB, etc) ou se DB não tem FK.
   */
  async collectCatalogForeignKeys(catalog: string): Promise<FkEdge[]> {
    const nativeSql = `
      SELECT
        tc.table_schema AS src_schema,
        tc.table_name AS src_table,
        kcu.column_name AS src_column,
        ccu.table_schema AS ref_schema,
        ccu.table_name AS ref_table,
        ccu.column_name AS ref_column,
        kcu.ordinal_position AS ord
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      ORDER BY tc.table_schema, tc.table_name, kcu.ordinal_position
    `;
    const escaped = nativeSql.replace(/'/g, "''");
    const passthroughSql = `SELECT * FROM TABLE("${catalog}".system.query(query => '${escaped}'))`;

    // executeQuery LANÇA em erro de query do Trino (ex.: MongoDB não tem system.query(query=>...)).
    // Passthrough de FK é best-effort: qualquer falha vira [] e não derruba o sync do catálogo.
    let result;
    try {
      result = await this.trinoClient.executeQuery({
        sql_query: passthroughSql,
        catalog: 'system',
        timeout: 30000,
      });
    } catch (err: any) {
      this.logger.debug(
        `Catálogo ${catalog}: extração de FK ignorada (conector não suporta passthrough). ${err?.message ?? String(err)}`,
      );
      return [];
    }

    if (!result.success || !result.data) {
      this.logger.debug(
        `Catálogo ${catalog}: extração de FK ignorada (conector não suporta passthrough ou sem FKs). ${result.error ?? ''}`,
      );
      return [];
    }

    const rows = result.data as Record<string, unknown>[];
    const edges: FkEdge[] = [];
    for (const row of rows) {
      const srcTable = this.getStr(row, 'src_table');
      const srcColumn = this.getStr(row, 'src_column');
      const refTable = this.getStr(row, 'ref_table');
      const refColumn = this.getStr(row, 'ref_column');
      if (!srcTable || !srcColumn || !refTable || !refColumn) continue;
      const srcSchema = this.getStr(row, 'src_schema');
      const refSchema = this.getStr(row, 'ref_schema');
      if (isSystemSchema(srcSchema) || isSystemSchema(refSchema)) continue;
      edges.push({
        src_schema: srcSchema,
        src_table: srcTable,
        src_column: srcColumn,
        ref_schema: refSchema,
        ref_table: refTable,
        ref_column: refColumn,
      });
    }

    this.logger.log(`Catálogo ${catalog}: ${edges.length} FK(s) extraída(s) via passthrough`);
    return edges;
  }

  private getStr(row: Record<string, unknown>, key: string): string {
    const v = row[key] ?? row[key.toLowerCase()];
    return v != null ? String(v).trim() : '';
  }

  /**
   * Lista schemas de todos os catálogos do Trino (somente leitura, não registra no RAG).
   */
  async listSchemas(): Promise<ListSchemasResponseDto> {
    const catalogs = await this.getCatalogs();
    this.logger.log(`Listando schemas dos catálogos: ${catalogs.join(', ')}`);

    const databases: ListSchemasDatabaseDto[] = [];

    for (const catalog of catalogs) {
      const tables = await this.collectCatalogSchema(catalog);
      const tableDtos: ListSchemasTableDto[] = tables.map((t) => ({
        name: t.name,
        columns: t.columns.map((c) => ({ name: c.name, type: c.type })),
      }));

      databases.push({
        database_id: catalog,
        database_name: catalog,
        tables: tableDtos,
      });
    }

    return { databases };
  }

  /**
   * Sincroniza schemas dos catálogos Trino com o RAG Orchestrator.
   */
  async syncSchemas(options?: { catalogs?: string[] }): Promise<SyncSchemasResponseDto> {
    const synced: SyncedCatalogDto[] = [];
    const errors: SyncSchemaErrorDto[] = [];

    let catalogs: string[];
    if (options?.catalogs?.length) {
      catalogs = options.catalogs;
      this.logger.log(`Sincronizando ${catalogs.length} catálogo(s) solicitado(s): ${catalogs.join(', ')}`);
    } else {
      catalogs = await this.getCatalogs();
      this.logger.log(`Catálogos detectados no Trino: ${catalogs.join(', ')}`);
    }

    for (const catalog of catalogs) {
      try {
        const tables = await this.collectCatalogSchema(catalog);
        if (tables.length === 0) {
          this.logger.warn(`Nenhuma tabela encontrada no catálogo ${catalog}; registrando mesmo assim.`);
        }

        const payload: RagRegisterSchemaRequestDto = {
          database_id: catalog,
          database_name: catalog,
          schema: { tables },
          version: '1.0.0',
        };

        await this.ragClient.registerSchema(payload);
        const fkEdges = await this.collectCatalogForeignKeys(catalog);
        await this.persistDependencyGraph(catalog, tables, fkEdges);
        synced.push({ database_id: catalog, success: true });
      } catch (err: any) {
        const message = err?.message ?? err?.response?.data?.message ?? String(err);
        this.logger.error(`Erro ao sincronizar ${catalog}: ${message}`);
        errors.push({ database_id: catalog, message });
      }
    }

    return { synced, errors: errors.length ? errors : undefined };
  }
}
