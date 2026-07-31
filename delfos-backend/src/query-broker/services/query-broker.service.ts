import { Injectable, Logger } from '@nestjs/common';
import { QueryAnalyzerService } from './query-analyzer.service';
import { RagOrchestratorClientService } from './rag-orchestrator-client.service';
import { AnalyzeQueryRequestDto } from '../dto/analyze-query-request.dto';
import { AnalyzeQueryResponseDto } from '../dto/analyze-query-response.dto';
import { RagContextRequestDto } from '../dto/rag-context-request.dto';

@Injectable()
export class QueryBrokerService {
  private readonly logger = new Logger(QueryBrokerService.name);

  constructor(
    private readonly queryAnalyzer: QueryAnalyzerService,
    private readonly ragOrchestratorClient: RagOrchestratorClientService,
  ) {}

  /**
   * Analisa uma consulta em linguagem natural e busca contexto relevante
   */
  async analyzeQuery(
    request: AnalyzeQueryRequestDto,
  ): Promise<AnalyzeQueryResponseDto> {
    const startTime = Date.now();
    this.logger.log(
      `Iniciando análise da consulta: ${request.natural_language_query.substring(0, 50)}...`,
    );

    try {
      // 1. Analisar a consulta e extrair componentes
      const components = this.queryAnalyzer.analyzeQuery(
        request.natural_language_query,
      );

      this.logger.debug(
        `Componentes extraídos: ${components.entities.length} entidades, ${components.filters.length} filtros`,
      );

      // 2. Preparar requisição para RAG Orchestrator
      const ragRequest: RagContextRequestDto = {
        natural_language_query: request.natural_language_query,
        max_results: request.max_context_results || 10,
        min_relevance_score: request.min_relevance_score ?? 0.6,
      };

      // 3. Buscar contexto do RAG Orchestrator
      let context;
      try {
        context = await this.ragOrchestratorClient.getContext(ragRequest);
        this.logger.debug(
          `Contexto obtido: ${context.schemas.length} schemas, ${context.queries.length} queries`,
        );
      } catch (error) {
        this.logger.warn(
          'Erro ao buscar contexto do RAG Orchestrator, usando contexto vazio',
          error,
        );
        // Continuar com contexto vazio se RAG falhar
        context = {
          schemas: [],
          queries: [],
          metadata: {
            total_schemas_found: 0,
            total_queries_found: 0,
            limit_applied: request.max_context_results || 10,
            search_time_ms: 0,
          },
        };
      }

      // 4. Combinar análise e contexto
      const analysisTime = Date.now() - startTime;

      const response: AnalyzeQueryResponseDto = {
        query: request.natural_language_query,
        components,
        context,
        analysis_time_ms: analysisTime,
      };

      this.logger.log(
        `Análise concluída em ${analysisTime}ms. Confiança: ${(components.confidence * 100).toFixed(1)}%`,
      );

      return response;
    } catch (error) {
      this.logger.error('Erro ao analisar consulta', error);
      throw error;
    }
  }

  /**
   * Valida se uma consulta pode ser processada
   */
  validateQuery(query: string): { valid: boolean; reason?: string } {
    if (!query || query.trim().length === 0) {
      return { valid: false, reason: 'Consulta vazia' };
    }

    if (query.length > 1000) {
      return {
        valid: false,
        reason: 'Consulta muito longa (máximo 1000 caracteres)',
      };
    }

    return { valid: true };
  }
}
