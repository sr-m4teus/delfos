import {
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { RagContextRequestDto } from '../dto/rag-context-request.dto';
import { RagContextResponseDto } from '../dto/rag-context-response.dto';
import {
  RagRegisterSchemaRequestDto,
  RagRegisterSchemaResponseDto,
} from '../dto/rag-register-schema.dto';

@Injectable()
export class RagOrchestratorClientService {
  private readonly logger = new Logger(RagOrchestratorClientService.name);
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl =
      this.configService.get<string>('RAG_ORCHESTRATOR_URL') ||
      'http://localhost:8001';
    this.timeout =
      this.configService.get<number>('RAG_ORCHESTRATOR_TIMEOUT') || 30000;

    if (!this.configService.get<string>('RAG_ORCHESTRATOR_URL')) {
      this.logger.warn(
        'RAG_ORCHESTRATOR_URL não configurada. Usando padrão: http://localhost:8001',
      );
    }
  }

  /**
   * Busca contexto relevante do RAG Orchestrator
   */
  async getContext(
    request: RagContextRequestDto,
  ): Promise<RagContextResponseDto> {
    try {
      const url = `${this.baseUrl}/api/v1/context`;

      this.logger.debug(
        `Buscando contexto para consulta: ${request.natural_language_query.substring(0, 50)}...`,
      );

      const response = await firstValueFrom(
        this.httpService.post<RagContextResponseDto>(url, request, {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      );

      this.logger.log(
        `Contexto obtido: ${response.data.schemas.length} schemas, ${response.data.queries.length} queries`,
      );

      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        const status = error.response?.status || HttpStatus.SERVICE_UNAVAILABLE;
        const message =
          error.response?.data?.error?.message ||
          error.message ||
          'Erro ao buscar contexto no RAG Orchestrator';

        this.logger.error(
          `Erro ao buscar contexto: ${message}`,
          error.stack,
        );

        // Se for erro de conexão/timeout, retornar resposta vazia ao invés de erro
        if (
          error.code === 'ECONNREFUSED' ||
          error.code === 'ETIMEDOUT' ||
          status === HttpStatus.SERVICE_UNAVAILABLE
        ) {
          this.logger.warn(
            'RAG Orchestrator indisponível, retornando contexto vazio',
          );
          return this.getEmptyContext();
        }

        throw new HttpException(
          `RAG_ORCHESTRATOR_ERROR: ${message}`,
          status,
        );
      }

      this.logger.error('Erro inesperado ao buscar contexto', error);
      throw new HttpException(
        'Erro interno ao buscar contexto',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Retorna um contexto vazio quando o RAG Orchestrator está indisponível
   */
  private getEmptyContext(): RagContextResponseDto {
    return {
      schemas: [],
      queries: [],
      metadata: {
        total_schemas_found: 0,
        total_queries_found: 0,
        limit_applied: 10,
        search_time_ms: 0,
      },
    };
  }

  /**
   * Marca uma consulta como válida no RAG Orchestrator.
   * metadata.tables associa a query às tabelas para contexto por tabela.
   */
  async getQueryHistory(
    userId: string,
    limit: number = 50,
  ): Promise<{
    items: Array<{
      id: string;
      natural_language_query: string;
      sql_query: string;
      validated_at: string;
      tables?: string[];
      catalog?: string;
      schema?: string;
    }>;
    total_returned: number;
  }> {
    try {
      const url = `${this.baseUrl}/api/v1/queries/history`;
      const cap = Math.min(100, Math.max(1, limit));
      const response = await firstValueFrom(
        this.httpService.get(url, {
          timeout: this.timeout,
          params: { user_id: userId, limit: cap },
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      );
      const data = response.data as {
        items?: unknown[];
        total_returned?: number;
      };
      return {
        items: (data.items || []) as Array<{
          id: string;
          natural_language_query: string;
          sql_query: string;
          validated_at: string;
          tables?: string[];
          catalog?: string;
          schema?: string;
        }>,
        total_returned: data.total_returned ?? (data.items?.length || 0),
      };
    } catch (error) {
      if (error instanceof AxiosError) {
        const status = error.response?.status || HttpStatus.SERVICE_UNAVAILABLE;
        const message =
          error.response?.data?.detail ||
          error.response?.data?.error?.message ||
          error.message ||
          'Erro ao obter histórico no RAG Orchestrator';

        this.logger.error(`Erro ao obter histórico de consultas: ${message}`, error.stack);

        if (
          error.code === 'ECONNREFUSED' ||
          error.code === 'ETIMEDOUT' ||
          status === HttpStatus.SERVICE_UNAVAILABLE
        ) {
          return { items: [], total_returned: 0 };
        }

        throw new HttpException(`RAG_ORCHESTRATOR_ERROR: ${message}`, status);
      }

      this.logger.error('Erro inesperado ao obter histórico de consultas', error);
      throw new HttpException(
        'Erro interno ao obter histórico de consultas',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async markQueryAsValid(data: {
    natural_language_query: string;
    sql_query: string;
    context?: {
      schemas?: any[];
      queries?: any[];
    };
    metadata?: {
      tables?: string[];
      catalog?: string;
      schema?: string;
      user_id?: string;
    };
  }): Promise<{ id: string; validated_at: Date; success: boolean }> {
    try {
      const url = `${this.baseUrl}/api/v1/queries/validate`;
      const nlPreview = data.natural_language_query
        ? data.natural_language_query.substring(0, 50) + '...'
        : '(query executada)';

      this.logger.debug(`Marcando consulta como válida: ${nlPreview}`);

      const requestBody = {
        natural_language_query: data.natural_language_query,
        sql_query: data.sql_query,
        context_used: data.context || {},
        metadata: data.metadata || {},
      };

      const response = await firstValueFrom(
        this.httpService.post(url, requestBody, {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      );

      this.logger.log(
        `Consulta marcada como válida: ${response.data.id}`,
      );

      return {
        id: response.data.id,
        validated_at: new Date(response.data.validated_at),
        success: response.data.success,
      };
    } catch (error) {
      if (error instanceof AxiosError) {
        const status = error.response?.status || HttpStatus.SERVICE_UNAVAILABLE;
        const message =
          error.response?.data?.detail ||
          error.response?.data?.error?.message ||
          error.message ||
          'Erro ao marcar consulta como válida no RAG Orchestrator';

        this.logger.error(
          `Erro ao marcar consulta como válida: ${message}`,
          error.stack,
        );

        throw new HttpException(
          `RAG_ORCHESTRATOR_ERROR: ${message}`,
          status,
        );
      }

      this.logger.error('Erro inesperado ao marcar consulta como válida', error);
      throw new HttpException(
        'Erro interno ao marcar consulta como válida',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Registra um schema de banco de dados no RAG Orchestrator
   */
  async registerSchema(
    payload: RagRegisterSchemaRequestDto,
  ): Promise<RagRegisterSchemaResponseDto> {
    try {
      const url = `${this.baseUrl}/api/v1/schemas`;

      this.logger.debug(
        `Registrando schema no RAG: ${payload.database_id} (${payload.schema?.tables?.length ?? 0} tabelas)`,
      );

      const response = await firstValueFrom(
        this.httpService.post<RagRegisterSchemaResponseDto>(url, payload, {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      );

      this.logger.log(`Schema registrado: ${response.data.database_id}`);

      return {
        database_id: response.data.database_id,
        registered_at: response.data.registered_at,
        version: response.data.version,
        success: response.data.success,
      };
    } catch (error) {
      if (error instanceof AxiosError) {
        const status = error.response?.status || HttpStatus.SERVICE_UNAVAILABLE;
        const message =
          error.response?.data?.detail ||
          error.response?.data?.error?.message ||
          error.message ||
          'Erro ao registrar schema no RAG Orchestrator';

        this.logger.error(
          `Erro ao registrar schema ${payload.database_id}: ${message}`,
          error.stack,
        );

        throw new HttpException(
          `RAG_ORCHESTRATOR_ERROR: ${message}`,
          status,
        );
      }

      this.logger.error('Erro inesperado ao registrar schema', error);
      throw new HttpException(
        'Erro interno ao registrar schema',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
