import { ApiProperty } from '@nestjs/swagger';

export class TranslateQueryResponseDto {
  @ApiProperty({
    description: 'SQL traduzido da consulta em linguagem natural',
    example: 'SELECT * FROM customers WHERE total > 1000 AND created_at >= CURRENT_DATE - INTERVAL \'1 month\'',
  })
  sql_query: string;

  @ApiProperty({
    description: 'Modelo usado para tradução',
    example: 'openai/gpt-4o-mini',
  })
  model: string;

  @ApiProperty({
    description: 'Tokens usados na requisição',
    type: 'object',
    properties: {
      prompt_tokens: { type: 'number', example: 150 },
      completion_tokens: { type: 'number', example: 50 },
      total_tokens: { type: 'number', example: 200 },
    },
  })
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };

  @ApiProperty({
    description: 'ID da requisição',
    example: 'gen-abc123',
  })
  request_id: string;
}
