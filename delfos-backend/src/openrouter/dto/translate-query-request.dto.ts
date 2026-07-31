import { ApiProperty } from '@nestjs/swagger';

export class SchemaContextDto {
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
    example: {
      tables: [
        {
          name: 'customers',
          columns: [
            { name: 'id', type: 'uuid' },
            { name: 'name', type: 'varchar' },
            { name: 'total', type: 'decimal' },
          ],
        },
      ],
    },
  })
  schema: Record<string, any>;

  @ApiProperty({
    description: 'Score de relevância',
    example: 0.85,
  })
  relevance_score: number;
}

export class QueryExampleDto {
  @ApiProperty({
    description: 'Consulta em linguagem natural',
    example: 'Mostre todos os clientes',
  })
  natural_language_query: string;

  @ApiProperty({
    description: 'SQL correspondente',
    example: 'SELECT * FROM customers',
  })
  sql_query: string;

  @ApiProperty({
    description: 'Similaridade semântica (consulta exemplo vs pergunta atual)',
    example: 0.75,
  })
  similarity: number;
}

export class TranslateQueryRequestDto {
  @ApiProperty({
    description: 'Consulta em linguagem natural do usuário',
    example: 'Mostre todos os clientes que compraram mais de 1000 reais este mês',
  })
  natural_language_query: string;

  @ApiProperty({
    description: 'Schemas relevantes dos bancos de dados',
    type: [SchemaContextDto],
    required: false,
  })
  schemas?: SchemaContextDto[];

  @ApiProperty({
    description: 'Exemplos de consultas similares bem-sucedidas',
    type: [QueryExampleDto],
    required: false,
  })
  query_examples?: QueryExampleDto[];

  @ApiProperty({
    description: 'Modelo LLM a ser usado (opcional, usa padrão se não especificado)',
    example: 'openai/gpt-4o-mini',
    required: false,
  })
  model?: string;
}
