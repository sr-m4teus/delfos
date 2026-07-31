import { ApiProperty } from '@nestjs/swagger';

export class ListSchemasColumnDto {
  @ApiProperty({ example: 'id', description: 'Nome da coluna' })
  name: string;

  @ApiProperty({ example: 'integer', description: 'Tipo de dado' })
  type: string;
}

export class ListSchemasTableDto {
  @ApiProperty({
    example: 'public.users',
    description: 'Nome completo da tabela (schema.tabela)',
  })
  name: string;

  @ApiProperty({
    type: [ListSchemasColumnDto],
    description: 'Colunas da tabela',
  })
  columns: ListSchemasColumnDto[];
}

export class ListSchemasDatabaseDto {
  @ApiProperty({
    example: 'supabase_targets',
    description: 'Identificador do banco/catálogo',
  })
  database_id: string;

  @ApiProperty({
    example: 'supabase_targets',
    description: 'Nome amigável do banco',
    required: false,
  })
  database_name?: string;

  @ApiProperty({
    type: [ListSchemasTableDto],
    description: 'Tabelas do banco',
  })
  tables: ListSchemasTableDto[];
}

export class ListSchemasResponseDto {
  @ApiProperty({
    type: [ListSchemasDatabaseDto],
    description: 'Lista de bancos com suas tabelas e colunas',
  })
  databases: ListSchemasDatabaseDto[];
}
