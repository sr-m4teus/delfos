import { ApiProperty } from '@nestjs/swagger';
import { QueryComponentsDto } from './query-components.dto';
import {
  RagContextResponseDto,
  SchemaResultDto,
  QueryResultDto,
  ContextMetadataDto,
} from './rag-context-response.dto';

export class AnalyzeQueryResponseDto {
  @ApiProperty({
    description: 'Consulta original em linguagem natural',
    example: 'Mostre todos os clientes que compraram mais de 1000 reais este mês',
  })
  query: string;

  @ApiProperty({
    description: 'Componentes extraídos da consulta',
    type: QueryComponentsDto,
  })
  components: QueryComponentsDto;

  @ApiProperty({
    description: 'Contexto obtido do RAG Orchestrator',
    type: RagContextResponseDto,
  })
  context: RagContextResponseDto;

  @ApiProperty({
    description: 'Tempo total de análise em milissegundos',
    example: 250.5,
  })
  analysis_time_ms: number;
}
