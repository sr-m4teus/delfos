import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MaxLength, IsNumber, Min, Max } from 'class-validator';
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
    description: 'Timeout em milissegundos (opcional)',
    example: 30000,
    required: false,
  })
  @IsOptional()
  timeout?: number;

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
