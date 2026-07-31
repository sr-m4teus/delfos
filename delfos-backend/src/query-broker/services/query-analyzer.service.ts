import { Injectable, Logger } from '@nestjs/common';
import { QueryComponentsDto, FilterDto, RelationshipDto } from '../dto/query-components.dto';

@Injectable()
export class QueryAnalyzerService {
  private readonly logger = new Logger(QueryAnalyzerService.name);

  // Dicionários de termos
  private readonly actionKeywords: Map<string, string[]> = new Map([
    ['mostrar', ['SELECT', 'SHOW']],
    ['mostre', ['SELECT', 'SHOW']],
    ['listar', ['SELECT']],
    ['liste', ['SELECT']],
    ['buscar', ['SELECT', 'SEARCH']],
    ['busque', ['SELECT', 'SEARCH']],
    ['encontrar', ['SELECT', 'FIND']],
    ['encontre', ['SELECT', 'FIND']],
    ['contar', ['COUNT']],
    ['conte', ['COUNT']],
    ['somar', ['SUM']],
    ['some', ['SUM']],
    ['média', ['AVG']],
    ['media', ['AVG']],
    ['máximo', ['MAX']],
    ['maximo', ['MAX']],
    ['mínimo', ['MIN']],
    ['minimo', ['MIN']],
  ]);

  private readonly aggregationKeywords: Map<string, string> = new Map([
    ['total', 'SUM'],
    ['soma', 'SUM'],
    ['somar', 'SUM'],
    ['média', 'AVG'],
    ['media', 'AVG'],
    ['máximo', 'MAX'],
    ['maximo', 'MAX'],
    ['mínimo', 'MIN'],
    ['minimo', 'MIN'],
    ['contar', 'COUNT'],
    ['quantidade', 'COUNT'],
    ['qtd', 'COUNT'],
  ]);

  private readonly comparisonOperators: Map<string, string> = new Map([
    ['mais que', '>'],
    ['mais de', '>'],
    ['maior que', '>'],
    ['maior de', '>'],
    ['menos que', '<'],
    ['menos de', '<'],
    ['menor que', '<'],
    ['menor de', '<'],
    ['igual a', '='],
    ['igual', '='],
    ['diferente de', '!='],
    ['diferente', '!='],
    ['contém', 'LIKE'],
    ['contem', 'LIKE'],
    ['entre', 'BETWEEN'],
  ]);

  private readonly relationshipKeywords: Map<string, string> = new Map([
    ['que compraram', 'has_many'],
    ['que comprou', 'has_many'],
    ['que venderam', 'has_many'],
    ['que vendeu', 'has_many'],
    ['de', 'belongs_to'],
    ['do', 'belongs_to'],
    ['da', 'belongs_to'],
    ['com', 'many_to_many'],
  ]);

  /**
   * Analisa uma consulta em linguagem natural e extrai componentes
   */
  analyzeQuery(query: string): QueryComponentsDto {
    const startTime = Date.now();
    this.logger.debug(`Analisando consulta: ${query}`);

    const normalizedQuery = this.normalizeQuery(query);
    const tokens = this.tokenize(normalizedQuery);

    const components: QueryComponentsDto = {
      entities: this.extractEntities(normalizedQuery, tokens),
      actions: this.extractActions(normalizedQuery, tokens),
      filters: this.extractFilters(normalizedQuery),
      aggregations: this.extractAggregations(normalizedQuery, tokens),
      relationships: this.extractRelationships(normalizedQuery, tokens),
      confidence: this.calculateConfidence(normalizedQuery, tokens),
    };

    const analysisTime = Date.now() - startTime;
    this.logger.debug(
      `Análise concluída em ${analysisTime}ms. Entidades: ${components.entities.length}, Filtros: ${components.filters.length}`,
    );

    return components;
  }

  /**
   * Normaliza a consulta (lowercase, remove acentos básicos)
   */
  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  /**
   * Tokeniza a consulta em palavras
   */
  private tokenize(query: string): string[] {
    return query
      .split(/\s+/)
      .filter((token) => token.length > 0)
      .map((token) => token.replace(/[.,!?;:]/g, ''));
  }

  /**
   * Extrai entidades (tabelas) mencionadas na consulta
   */
  private extractEntities(query: string, tokens: string[]): string[] {
    const entities: Set<string> = new Set();

    // Padrões comuns para identificar entidades
    const entityPatterns = [
      /(?:todos?|as?|os?)\s+([a-záàâãéêíóôõúç]+)/gi,
      /(?:os?|as?)\s+([a-záàâãéêíóôõúç]+)\s+(?:que|onde|com)/gi,
      /([a-záàâãéêíóôõúç]+)\s+(?:que|onde|com|de|do|da)/gi,
    ];

    // Palavras comuns que indicam entidades (substantivos)
    const commonEntities = [
      'clientes',
      'cliente',
      'compras',
      'compra',
      'vendas',
      'venda',
      'produtos',
      'produto',
      'fornecedores',
      'fornecedor',
      'pedidos',
      'pedido',
      'usuarios',
      'usuario',
      'funcionarios',
      'funcionario',
      'categorias',
      'categoria',
    ];

    // Buscar por padrões
    entityPatterns.forEach((pattern) => {
      const matches = query.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].length > 3) {
          entities.add(match[1]);
        }
      }
    });

    // Buscar palavras conhecidas
    commonEntities.forEach((entity) => {
      if (query.includes(entity)) {
        entities.add(entity);
      }
    });

    // Remover palavras que não são entidades (stop words)
    const stopWords = new Set([
      'todos',
      'todas',
      'os',
      'as',
      'que',
      'onde',
      'com',
      'de',
      'do',
      'da',
      'este',
      'esta',
      'esse',
      'essa',
      'aquele',
      'aquela',
      'mais',
      'menos',
      'muito',
      'pouco',
    ]);

    const filteredEntities = Array.from(entities).filter(
      (entity) => !stopWords.has(entity) && entity.length > 2,
    );

    return filteredEntities;
  }

  /**
   * Extrai ações (SELECT, COUNT, SUM, etc.)
   */
  private extractActions(query: string, tokens: string[]): string[] {
    const actions: Set<string> = new Set();

    // Verificar palavras-chave de ação
    for (const [keyword, actionTypes] of this.actionKeywords.entries()) {
      if (query.includes(keyword)) {
        actionTypes.forEach((action) => actions.add(action));
      }
    }

    // Se não encontrou ação específica, assume SELECT
    if (actions.size === 0) {
      actions.add('SELECT');
    }

    return Array.from(actions);
  }

  /**
   * Extrai filtros e condições da consulta
   */
  private extractFilters(query: string): FilterDto[] {
    const filters: FilterDto[] = [];

    // Padrões para filtros numéricos
    const numericPatterns = [
      {
        pattern: /(mais\s+(?:de|que)|maior\s+(?:que|de))\s+(\d+)/gi,
        operator: '>',
      },
      {
        pattern: /(menos\s+(?:de|que)|menor\s+(?:que|de))\s+(\d+)/gi,
        operator: '<',
      },
      {
        pattern: /igual\s+a\s+(\d+)/gi,
        operator: '=',
      },
      {
        pattern: /(\d+)\s+(?:reais|r\$|dolares|\$)/gi,
        operator: '>',
        valueIndex: 1,
      },
    ];

    numericPatterns.forEach(({ pattern, operator, valueIndex }) => {
      const matches = query.matchAll(pattern);
      for (const match of matches) {
        const value = valueIndex ? match[valueIndex] : match[2];
        filters.push({
          field: 'valor', // Campo genérico, pode ser refinado depois
          operator,
          value: parseInt(value, 10),
          originalText: match[0],
        });
      }
    });

    // Padrões para filtros temporais
    const temporalPatterns = [
      {
        pattern: /este\s+m[eê]s/gi,
        operator: '=',
        value: 'current_month',
        field: 'data',
      },
      {
        pattern: /m[eê]s\s+passado/gi,
        operator: '=',
        value: 'last_month',
        field: 'data',
      },
      {
        pattern: /este\s+ano/gi,
        operator: '=',
        value: 'current_year',
        field: 'ano',
      },
      {
        pattern: /ano\s+passado/gi,
        operator: '=',
        value: 'last_year',
        field: 'ano',
      },
    ];

    temporalPatterns.forEach(({ pattern, operator, value, field }) => {
      if (pattern.test(query)) {
        filters.push({
          field,
          operator,
          value: value as string,
          originalText: query.match(pattern)?.[0] || '',
        });
      }
    });

    // Padrões para filtros de texto
    const textPatterns = [
      {
        pattern: /(?:que|onde)\s+([a-záàâãéêíóôõúç]+)\s+(?:é|está|contém|contem)\s+(.+?)(?:\s|$)/gi,
        operator: 'LIKE',
      },
    ];

    textPatterns.forEach(({ pattern, operator }) => {
      const matches = query.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[2]) {
          filters.push({
            field: match[1],
            operator,
            value: match[2].trim(),
            originalText: match[0],
          });
        }
      }
    });

    return filters;
  }

  /**
   * Extrai agregações (SUM, AVG, COUNT, etc.)
   */
  private extractAggregations(query: string, tokens: string[]): string[] {
    const aggregations: Set<string> = new Set();

    // Verificar palavras-chave de agregação
    for (const [keyword, aggregation] of this.aggregationKeywords.entries()) {
      if (query.includes(keyword)) {
        aggregations.add(aggregation);
      }
    }

    // Verificar ações que são agregações
    const aggregationActions = ['COUNT', 'SUM', 'AVG', 'MAX', 'MIN'];
    aggregationActions.forEach((action) => {
      if (query.includes(action.toLowerCase())) {
        aggregations.add(action);
      }
    });

    return Array.from(aggregations);
  }

  /**
   * Extrai relacionamentos entre entidades
   */
  private extractRelationships(
    query: string,
    tokens: string[],
  ): RelationshipDto[] {
    const relationships: RelationshipDto[] = [];
    const entities = this.extractEntities(query, tokens);

    if (entities.length < 2) {
      return relationships;
    }

    // Padrões de relacionamento
    for (const [keyword, type] of this.relationshipKeywords.entries()) {
      if (query.includes(keyword)) {
        // Tentar identificar entidades relacionadas
        for (let i = 0; i < entities.length - 1; i++) {
          relationships.push({
            fromEntity: entities[i],
            toEntity: entities[i + 1],
            type,
            confidence: 0.7,
          });
        }
      }
    }

    // Se não encontrou relacionamento explícito mas tem múltiplas entidades
    if (relationships.length === 0 && entities.length >= 2) {
      relationships.push({
        fromEntity: entities[0],
        toEntity: entities[1],
        type: 'has_many',
        confidence: 0.5,
      });
    }

    return relationships;
  }

  /**
   * Calcula a confiança na análise (0-1)
   */
  private calculateConfidence(query: string, tokens: string[]): number {
    let confidence = 0.5; // Base

    // Aumentar confiança se encontrou entidades
    const entities = this.extractEntities(query, tokens);
    if (entities.length > 0) {
      confidence += 0.2;
    }
    if (entities.length > 1) {
      confidence += 0.1;
    }

    // Aumentar confiança se encontrou ações específicas
    const actions = this.extractActions(query, tokens);
    if (actions.length > 0 && !actions.includes('SELECT')) {
      confidence += 0.1;
    }

    // Aumentar confiança se encontrou filtros
    const filters = this.extractFilters(query);
    if (filters.length > 0) {
      confidence += 0.1;
    }

    // Limitar entre 0 e 1
    return Math.min(1, Math.max(0, confidence));
  }
}
