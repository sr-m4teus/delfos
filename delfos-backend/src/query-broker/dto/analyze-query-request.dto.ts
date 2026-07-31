import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, IsNumber } from 'class-validator';

export class AnalyzeQueryRequestDto {
  @ApiProperty({
    description: 'Consulta em linguagem natural do usuário',
    example: 'Mostre todos os clientes que compraram mais de 1000 reais este mês',
    minLength: 1,
  })
  @IsString()
  natural_language_query: string;

  @ApiProperty({
    description: 'Número máximo de resultados de contexto a retornar',
    example: 10,
    default: 10,
    minimum: 1,
    maximum: 100,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  max_context_results?: number;

  @ApiProperty({
    description: 'Score mínimo de relevância para contexto',
    example: 0.6,
    default: 0.6,
    minimum: 0,
    maximum: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  min_relevance_score?: number;
}
