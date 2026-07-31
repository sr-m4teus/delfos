import { Injectable, Logger } from '@nestjs/common';
// Trino parser for best compatibility with Trino SQL
import { Parser } from 'node-sql-parser/build/trino';

/**
 * Extrai nomes de tabelas de uma query SQL (FROM, JOIN, subqueries).
 * Formato do node-sql-parser: "type::dbOrSchema::tableName" (ex: "select::null::t" ou "select::schema::t").
 */
@Injectable()
export class SqlParserService {
  private readonly logger = new Logger(SqlParserService.name);
  private readonly parser = new Parser();

  /**
   * Retorna lista de identificadores de tabelas referenciadas na query.
   * Ex: ["customers", "schema.orders"]. Em caso de erro no parse, retorna [].
   */
  extractTableNames(sql: string): string[] {
    if (!sql || typeof sql !== 'string' || !sql.trim()) {
      return [];
    }
    try {
      const rawList = this.parser.tableList(sql);
      if (!Array.isArray(rawList) || rawList.length === 0) {
        return [];
      }
      const tables = new Set<string>();
      for (const entry of rawList) {
        const name = this.normalizeTableListEntry(entry);
        if (name) tables.add(name);
      }
      return Array.from(tables);
    } catch (err) {
      this.logger.warn(
        `Falha ao extrair tabelas do SQL: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }
  }

  /**
   * Converte entrada no formato "type::dbOrSchema::tableName" em identificador legível.
   * "select::null::customers" -> "customers"
   * "select::myschema::customers" -> "myschema.customers"
   */
  private normalizeTableListEntry(entry: string): string {
    const parts = String(entry).split('::');
    if (parts.length < 3) return parts[parts.length - 1] || '';
    const [, dbOrSchema, tableName] = parts;
    if (!tableName) return '';
    if (!dbOrSchema || dbOrSchema === 'null') return tableName;
    return `${dbOrSchema}.${tableName}`;
  }
}
