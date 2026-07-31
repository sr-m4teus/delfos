import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, IsNumber } from 'class-validator';

export class RagContextRequestDto {
  @ApiProperty({
    description: 'Consulta em linguagem natural do usuário',
    example: 'Mostre todos os clientes que compraram mais de 1000 reais este mês',
    minLength: 1,
    maxLength: 1000,
  })
  @IsString()
  natural_language_query: string;

  @ApiProperty({
    description: 'Número máximo de resultados por tipo (schemas/queries)',
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
  max_results?: number;

  @ApiProperty({
    description: 'Score mínimo de relevância para incluir resultado',
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

  @ApiProperty({
    description:
      'Profundidade BFS na expansão pelo grafo de FK. Default vem do orchestrator (FK_EXPANSION_DEPTH).',
    example: 2,
    minimum: 0,
    maximum: 10,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  fk_expansion_depth?: number;
}
