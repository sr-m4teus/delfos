import { ApiProperty } from '@nestjs/swagger';

export class SchemaResultDto {
  @ApiProperty({
    description: 'Identificador do banco de dados',
    example: 'db1',
  })
  database_id: string;

  @ApiProperty({
    description: 'Nome do banco de dados',
    example: 'Vendas',
    required: false,
  })
  database_name?: string;

  @ApiProperty({
    description: 'Schema completo do banco de dados',
    type: 'object',
    additionalProperties: true,
  })
  schema: Record<string, any>;

  @ApiProperty({
    description: 'Score de relevância (0.0 a 1.0)',
    example: 0.85,
    minimum: 0,
    maximum: 1,
  })
  relevance_score: number;

  @ApiProperty({
    description: 'Posição no ranking de relevância',
    example: 1,
    minimum: 1,
  })
  rank: number;
}

export class QueryResultDto {
  @ApiProperty({
    description: 'Identificador único da consulta validada',
    example: 'query-123',
  })
  id: string;

  @ApiProperty({
    description: 'Consulta original em linguagem natural',
    example: 'Mostre todos os clientes',
  })
  natural_language_query: string;

  @ApiProperty({
    description: 'SQL gerado correspondente',
    example: 'SELECT * FROM customers',
  })
  sql_query: string;

  @ApiProperty({
    description:
      'Similaridade semântica entre a NL do usuário e a chave NL armazenada no RAG (0.0 a 1.0)',
    example: 0.75,
    minimum: 0,
    maximum: 1,
  })
  similarity: number;

  @ApiProperty({
    description: 'Posição no ranking de relevância',
    example: 1,
    minimum: 1,
  })
  rank: number;

  @ApiProperty({
    description: 'Timestamp de validação',
    required: false,
  })
  validated_at?: Date;
}

export class ContextMetadataDto {
  @ApiProperty({
    description: 'Total de schemas encontrados',
    example: 5,
    minimum: 0,
  })
  total_schemas_found: number;

  @ApiProperty({
    description: 'Total de consultas encontradas',
    example: 3,
    minimum: 0,
  })
  total_queries_found: number;

  @ApiProperty({
    description: 'Limite aplicado aos resultados',
    example: 10,
    minimum: 1,
  })
  limit_applied: number;

  @ApiProperty({
    description: 'Tempo de busca em milissegundos',
    example: 125.5,
    required: false,
  })
  search_time_ms?: number;
}

export class RagContextResponseDto {
  @ApiProperty({
    description: 'Schemas relevantes',
    type: [SchemaResultDto],
  })
  schemas: SchemaResultDto[];

  @ApiProperty({
    description: 'Consultas relacionadas',
    type: [QueryResultDto],
  })
  queries: QueryResultDto[];

  @ApiProperty({
    description: 'Metadados da busca',
    type: ContextMetadataDto,
  })
  metadata: ContextMetadataDto;
}
