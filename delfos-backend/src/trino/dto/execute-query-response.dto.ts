import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export interface ColumnMetadata {
  name: string;
  type: string;
  typeSignature?: any;
}

/** Metadados de paginação (resultado Trino). */
export class PaginationInfoDto {
  @ApiProperty({ example: 1 })
  current_page: number;

  @ApiProperty({ example: 50 })
  page_size: number;

  @ApiProperty({
    description:
      'true se o Trino ainda tinha mais dados não consumidos (total global desconhecido). false quando a query foi totalmente consumida ou cancelada após leitura completa.',
    example: false,
  })
  has_more: boolean;

  @ApiPropertyOptional({
    description:
      'Total de linhas do resultado completo; omitido quando a leitura foi interrompida antes do fim (has_more true por parada antecipada).',
    example: 1250,
  })
  total_rows?: number;

  @ApiPropertyOptional({
    description: 'Total de páginas; omitido quando total_rows não é conhecido.',
    example: 25,
  })
  total_pages?: number;
}

export type PaginationInfo = PaginationInfoDto;

export class ExecuteQueryResponseDto {
  @ApiProperty({
    description: 'Indica se a execução foi bem-sucedida',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Dados retornados pela query (array de objetos)',
    example: [
      { id: 1, name: 'Cliente 1', total: 1500 },
      { id: 2, name: 'Cliente 2', total: 2000 },
    ],
    required: false,
  })
  data?: Record<string, any>[];

  @ApiProperty({
    description: 'Colunas retornadas pela query',
    example: ['id', 'name', 'total'],
    required: false,
  })
  columns?: string[];

  @ApiProperty({
    description: 'Metadados das colunas incluindo tipos de dados (detectados dinamicamente)',
    example: [
      { name: 'id', type: 'integer' },
      { name: 'name', type: 'varchar' },
      { name: 'total', type: 'double' },
    ],
    required: false,
  })
  column_types?: ColumnMetadata[];

  @ApiProperty({
    description: 'Número de linhas retornadas',
    example: 2,
    required: false,
  })
  row_count?: number;

  @ApiProperty({
    description:
      'Informações de paginação. Para consultas grandes com page/pageSize, total_rows e total_pages podem ser omitidos enquanto has_more for true.',
    type: PaginationInfoDto,
    required: false,
  })
  pagination?: PaginationInfo;

  @ApiProperty({
    description: 'Mensagem de erro (se houver)',
    required: false,
  })
  error?: string;

  @ApiProperty({
    description: 'Tempo de execução em milissegundos',
    example: 125.5,
    required: false,
  })
  execution_time_ms?: number;

  @ApiProperty({
    description: 'Metadados adicionais da execução',
    required: false,
  })
  metadata?: {
    query_id?: string;
    query_state?: string;
    stats?: Record<string, any>;
  };
}
