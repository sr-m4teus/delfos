import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, IsOptional, Min, IsNumber } from 'class-validator';

export class TranslateQueryRequestDto {
  @ApiProperty({
    description: 'Consulta em linguagem natural do usuário',
    example: 'Mostre todos os clientes que compraram mais de 1000 reais este mês',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  natural_language_query: string;

  @ApiProperty({
    description: 'Número máximo de resultados de contexto (opcional)',
    example: 10,
    required: false,
  })
  @IsOptional()
  @Min(1)
  max_context_results?: number;

  @ApiProperty({
    description: 'Score mínimo de relevância para contexto (opcional)',
    example: 0.6,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  min_relevance_score?: number;
}
