import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ExecuteQueryRequestDto {
  @ApiProperty({
    description: 'Query SQL a ser executada',
    example: 'SELECT * FROM customers WHERE total > 1000',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  sql_query: string;

  @ApiProperty({
    description:
      'Pergunta em linguagem natural associada à execução (opcional; usada no histórico e no RAG)',
    example: 'Total de vendas por região',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  natural_language_query?: string;

  @ApiProperty({
    description: 'Catalog do Trino (opcional)',
    example: 'default',
    required: false,
  })
  @IsOptional()
  @IsString()
  catalog?: string;

  @ApiProperty({
    description: 'Schema do Trino (opcional)',
    example: 'default',
    required: false,
  })
  @IsOptional()
  @IsString()
  schema?: string;

  @ApiProperty({
    description: 'Número da página para paginação (opcional, padrão: 1)',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiProperty({
    description: 'Tamanho da página para paginação (opcional, padrão: 50, máx: 100)',
    example: 50,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  pageSize?: number;
}
