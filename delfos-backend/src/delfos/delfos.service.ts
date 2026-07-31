import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueryBrokerService } from '../query-broker/services/query-broker.service';
import { OpenRouterService } from '../openrouter/openrouter.service';
import { QueryValidatorService } from '../query-validator/services/query-validator.service';
import { TrinoClientService } from '../trino/services/trino-client.service';
import { RagOrchestratorClientService } from '../query-broker/services/rag-orchestrator-client.service';
import { SqlParserService } from '../sql-parser/sql-parser.service';
import { SqlLiteralSanitizerService } from '../sql-parser/sql-literal-sanitizer.service';
import { TranslateQueryRequestDto } from './dto/translate-query-request.dto';
import { TranslateQueryResponseDto } from './dto/translate-query-response.dto';
import { ValidateEditRequestDto } from './dto/validate-edit-request.dto';
import { ValidateEditResponseDto } from './dto/validate-edit-response.dto';
import { ExecuteQueryRequestDto } from './dto/execute-query-request.dto';
import { ExecuteQueryResponseDto } from './dto/execute-query-response.dto';
import { MarkSuccessRequestDto } from './dto/mark-success-request.dto';
import { MarkSuccessResponseDto } from './dto/mark-success-response.dto';
import { QueryHistoryListResponseDto } from './dto/query-history-response.dto';
import { AnalyzeQueryRequestDto } from '../query-broker/dto/analyze-query-request.dto';
import { TranslateQueryRequestDto as OpenRouterTranslateRequestDto } from '../openrouter/dto/translate-query-request.dto';
import { SubstituteSqlPlaceholdersRequestDto } from '../openrouter/dto/substitute-sql-placeholders-request.dto';
import { detectColumnTypes } from '../common/utils/data-type-detector';
import {
  parsePerfectSimilarityThreshold,
  pickTemplateSqlWithPerfectSimilarity,
} from './rag-similarity.util';

@Injectable()
export class DelfosService {
  private readonly logger = new Logger(DelfosService.name);

  constructor(
    private readonly queryBrokerService: QueryBrokerService,
    private readonly openRouterService: OpenRouterService,
    private readonly queryValidatorService: QueryValidatorService,
    private readonly trinoClientService: TrinoClientService,
    private readonly ragOrchestratorClient: RagOrchestratorClientService,
    private readonly sqlParserService: SqlParserService,
    private readonly sqlLiteralSanitizer: SqlLiteralSanitizerService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Traduz uma consulta em linguagem natural para SQL validado
   */
  async translateQuery(
    request: TranslateQueryRequestDto,
  ): Promise<TranslateQueryResponseDto> {
    const startTime = Date.now();
    this.logger.log(
      `Iniciando tradução: ${request.natural_language_query.substring(0, 50)}...`,
    );

    try {
      // 1. QueryBroker: Identificar tabelas possíveis e obter contexto do RAG
      const analyzeRequest: AnalyzeQueryRequestDto = {
        natural_language_query: request.natural_language_query,
        max_context_results: request.max_context_results || 10,
        min_relevance_score: request.min_relevance_score ?? 0.6,
      };

      const analysisResult = await this.queryBrokerService.analyzeQuery(
        analyzeRequest,
      );

      this.logger.debug(
        `Análise concluída: ${analysisResult.context.schemas.length} schemas, ${analysisResult.context.queries.length} queries relacionadas`,
      );

      const perfectThreshold = parsePerfectSimilarityThreshold(
        this.configService.get<string | number>('RAG_PERFECT_SIMILARITY_THRESHOLD'),
      );
      const templateSql = pickTemplateSqlWithPerfectSimilarity(
        analysisResult.context.queries,
        perfectThreshold,
      );

      let translationResult: {
        sql_query: string;
        model?: string;
        usage?: unknown;
        request_id?: string;
      };

      if (templateSql) {
        this.logger.debug(
          `RAG: similaridade >= ${perfectThreshold}; modo substituição de placeholders`,
        );
        const subRequest: SubstituteSqlPlaceholdersRequestDto = {
          natural_language_query: request.natural_language_query,
          template_sql: templateSql,
          schemas: analysisResult.context.schemas.map((schema) => ({
            database_id: schema.database_id,
            database_name: schema.database_name,
            schema: schema.schema,
            relevance_score: schema.relevance_score,
          })),
        };
        translationResult =
          await this.openRouterService.substitutePlaceholdersInSql(subRequest);
      } else {
        const openRouterRequest: OpenRouterTranslateRequestDto = {
          natural_language_query: request.natural_language_query,
          schemas: analysisResult.context.schemas.map((schema) => ({
            database_id: schema.database_id,
            database_name: schema.database_name,
            schema: schema.schema,
            relevance_score: schema.relevance_score,
          })),
          query_examples: analysisResult.context.queries.map((query) => ({
            natural_language_query: query.natural_language_query,
            sql_query: query.sql_query,
            similarity: query.similarity,
          })),
        };

        translationResult = await this.openRouterService.translateQueryToSql(
          openRouterRequest,
        );
      }

      this.logger.debug(`SQL gerado: ${translationResult.sql_query.substring(0, 50)}...`);

      // 3. QueryValidator: Validar segurança da query
      const validationResult = await this.queryValidatorService.validateQuery({
        sql_query: translationResult.sql_query,
      });

      if (!validationResult.valid) {
        this.logger.warn(
          `Query rejeitada pelo validador: ${validationResult.reason}`,
        );
        throw new HttpException(
          `Query inválida: ${validationResult.reason}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const translationTime = Date.now() - startTime;

      this.logger.log(
        `Tradução concluída em ${translationTime}ms. Query validada com sucesso.`,
      );

      return {
        sql_query: translationResult.sql_query,
        natural_language_query: request.natural_language_query,
        validated: true,
        warnings: validationResult.warnings,
        metadata: {
          model_used: translationResult.model,
          translation_time_ms: translationTime,
          context_schemas_count: analysisResult.context.schemas.length,
          context_queries_count: analysisResult.context.queries.length,
        },
      };
    } catch (error) {
      this.logger.error('Erro ao traduzir query', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Erro interno ao traduzir query',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Valida uma query editada pelo usuário
   */
  async validateEditedQuery(
    request: ValidateEditRequestDto,
  ): Promise<ValidateEditResponseDto> {
    this.logger.log(
      `Validando query editada: ${request.sql_query.substring(0, 50)}...`,
    );

    try {
      const validationResult =
        await this.queryValidatorService.validateEditedQuery({
          sql_query: request.sql_query,
        });

      return {
        valid: validationResult.valid,
        reason: validationResult.reason,
        warnings: validationResult.warnings,
        details: validationResult.details,
      };
    } catch (error) {
      this.logger.error('Erro ao validar query editada', error);
      throw new HttpException(
        'Erro interno ao validar query',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Histórico de consultas validadas no RAG para o usuário autenticado
   */
  async getQueryHistory(
    userId: string,
    limit: number = 50,
  ): Promise<QueryHistoryListResponseDto> {
    const raw = await this.ragOrchestratorClient.getQueryHistory(userId, limit);
    return {
      items: raw.items.map((item) => ({
        id: item.id,
        natural_language_query: item.natural_language_query,
        sql_query: item.sql_query,
        validated_at:
          typeof item.validated_at === 'string'
            ? item.validated_at
            : String(item.validated_at),
        tables: item.tables,
        catalog: item.catalog,
        schema: item.schema,
      })),
      total_returned: raw.total_returned,
    };
  }

  /**
   * Executa uma query SQL validada no Trino
   */
  async executeQuery(
    request: ExecuteQueryRequestDto,
    userId: string,
  ): Promise<ExecuteQueryResponseDto> {
    this.logger.log(
      `Executando query: ${request.sql_query.substring(0, 50)}...`,
    );

    try {
      // Validar query antes de executar
      const validationResult = await this.queryValidatorService.validateQuery({
        sql_query: request.sql_query,
      });

      if (!validationResult.valid) {
        throw new HttpException(
          `Query inválida: ${validationResult.reason}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Executar no Trino
      const trinoResult = await this.trinoClientService.executeQuery({
        sql_query: request.sql_query,
        catalog: request.catalog,
        schema: request.schema,
        page: request.page,
        pageSize: request.pageSize,
      });

      if (!trinoResult.success) {
        // Erro de execução: não registrar no RAG; expor como falha HTTP para o cliente
        throw new HttpException(
          trinoResult.error || 'Erro ao executar query no Trino',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Detectar tipos de dados dinamicamente a partir dos valores retornados
      // Usar os dados paginados para detecção (tipos devem ser consistentes)
      const columnTypes = trinoResult.columns && trinoResult.data && trinoResult.data.length > 0
        ? detectColumnTypes(trinoResult.data, trinoResult.columns)
        : trinoResult.columns
        ? detectColumnTypes([], trinoResult.columns) // Fallback: inferir do nome se não há dados
        : undefined;

      // Registrar query no RAG como contexto por tabela (fire-and-forget, após sucesso sem erro)
      const ragRegisterEnabled =
        this.configService.get<string>('RAG_REGISTER_EXECUTED_QUERIES', 'true') !== 'false';
      if (ragRegisterEnabled) {
        void this.registerExecutedQueryInRag(request, userId).catch((err) => {
          this.logger.warn(
            `Falha ao registrar query no RAG (não afeta a resposta): ${err instanceof Error ? err.message : String(err)}`,
          );
        });
      }

      return {
        success: true,
        data: trinoResult.data,
        columns: trinoResult.columns,
        column_types: columnTypes,
        row_count: trinoResult.row_count,
        pagination: trinoResult.pagination,
        execution_time_ms: trinoResult.execution_time_ms,
        sql_query: request.sql_query,
      };
    } catch (error) {
      this.logger.error('Erro ao executar query', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Erro interno ao executar query',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Registra no RAG uma query executada com sucesso, como contexto para as tabelas envolvidas.
   * Chamado em background após executeQuery (fire-and-forget).
   */
  private async registerExecutedQueryInRag(
    request: ExecuteQueryRequestDto,
    userId: string,
  ): Promise<void> {
    const tables = this.sqlParserService.extractTableNames(request.sql_query);
    const nl =
      request.natural_language_query?.trim() ||
      'Consulta executada pelo usuário';
    const sqlForRag = this.sqlLiteralSanitizer.sanitizeForRag(
      request.sql_query,
    );
    await this.ragOrchestratorClient.markQueryAsValid({
      natural_language_query: nl,
      sql_query: sqlForRag,
      context: {},
      metadata: {
        tables,
        catalog: request.catalog,
        schema: request.schema,
        user_id: userId,
      },
    });
  }

  /**
   * Marca uma consulta como bem-sucedida no RAG Orchestrator
   */
  async markQueryAsSuccess(
    request: MarkSuccessRequestDto,
    userId: string,
  ): Promise<MarkSuccessResponseDto> {
    this.logger.log(
      `Marcando consulta como bem-sucedida: ${request.natural_language_query.substring(0, 50)}...`,
    );

    try {
      const sqlForRag = this.sqlLiteralSanitizer.sanitizeForRag(
        request.sql_query,
      );
      const result = await this.ragOrchestratorClient.markQueryAsValid({
        natural_language_query: request.natural_language_query,
        sql_query: sqlForRag,
        context: request.context,
        metadata: { user_id: userId },
      });

      this.logger.log(
        `Consulta marcada como bem-sucedida: ${result.id}`,
      );

      return {
        success: true,
        query_id: result.id,
        message: 'Consulta marcada como bem-sucedida',
      };
    } catch (error) {
      this.logger.error('Erro ao marcar consulta como bem-sucedida', error);
      // Não falhar o fluxo se o RAG estiver indisponível
      return {
        success: false,
        message: 'Erro ao salvar consulta no RAG Orchestrator',
      };
    }
  }

}
