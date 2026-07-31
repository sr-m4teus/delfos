import { ApiProperty } from '@nestjs/swagger';
import {
  PaginationInfoDto,
  type ColumnMetadata,
  type PaginationInfo,
} from '../../trino/dto/execute-query-response.dto';

export class ExecuteQueryResponseDto {
  @ApiProperty({
    description: 'Indica se a execução foi bem-sucedida',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Dados retornados pela query',
    example: [
      { id: 1, name: 'Cliente 1', total: 1500 },
      { id: 2, name: 'Cliente 2', total: 2000 },
    ],
    required: false,
  })
  data?: Record<string, any>[];

  @ApiProperty({
    description: 'Colunas retornadas',
    example: ['id', 'name', 'total'],
    required: false,
  })
  columns?: string[];

  @ApiProperty({
    description: 'Metadados das colunas incluindo tipos de dados',
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
      'Informações de paginação (has_more true quando o total global ainda não foi materializado).',
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
    description: 'Query SQL executada',
    example: 'SELECT * FROM customers WHERE total > 1000',
    required: false,
  })
  sql_query?: string;
}
