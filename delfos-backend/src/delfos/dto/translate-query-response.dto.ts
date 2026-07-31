import { ApiProperty } from '@nestjs/swagger';

export class TranslateQueryResponseDto {
  @ApiProperty({
    description: 'Query SQL gerada',
    example: 'SELECT * FROM customers WHERE total > 1000',
  })
  sql_query: string;

  @ApiProperty({
    description: 'Consulta original em linguagem natural',
    example: 'Mostre todos os clientes que compraram mais de 1000 reais este mês',
  })
  natural_language_query: string;

  @ApiProperty({
    description: 'Indica se a query foi validada com sucesso',
    example: true,
  })
  validated: boolean;

  @ApiProperty({
    description: 'Avisos de validação (se houver)',
    example: ['Query pode ser otimizada'],
    required: false,
  })
  warnings?: string[];

  @ApiProperty({
    description: 'Metadados da tradução',
    required: false,
  })
  metadata?: {
    model_used?: string;
    translation_time_ms?: number;
    context_schemas_count?: number;
    context_queries_count?: number;
  };
}
