import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject, MinLength } from 'class-validator';

export class RagSchemaColumnDto {
  @ApiProperty({ example: 'id', description: 'Nome da coluna' })
  name: string;

  @ApiProperty({ example: 'integer', description: 'Tipo de dado' })
  type: string;
}

export class RagFkRefDto {
  @ApiProperty({ example: 'cliente_id', description: 'Coluna desta tabela que referencia' })
  column: string;

  @ApiProperty({ example: 'supabase_targets', description: 'Catálogo da tabela referenciada' })
  ref_database_id: string;

  @ApiProperty({ example: 'db_crm', description: 'Schema da tabela referenciada', required: false })
  ref_schema?: string;

  @ApiProperty({ example: 'clientes', description: 'Tabela referenciada' })
  ref_table: string;

  @ApiProperty({ example: 'id', description: 'Coluna referenciada' })
  ref_column: string;
}

export class RagSchemaTableDto {
  @ApiProperty({ example: 'veiculos', description: 'Nome da tabela' })
  name: string;

  @ApiProperty({
    example: 'Cadastro de veículos da frota, com status operacional e capacidade de carga.',
    description: 'Descrição de negócio da tabela em linguagem natural (glossário), usada para enriquecer o embedding de schema',
    required: false,
  })
  description?: string;

  @ApiProperty({
    type: [RagSchemaColumnDto],
    description: 'Colunas da tabela',
  })
  columns: RagSchemaColumnDto[];

  @ApiProperty({
    type: [RagFkRefDto],
    description: 'Chaves estrangeiras desta tabela',
    required: false,
  })
  foreign_keys?: RagFkRefDto[];
}

export class RagSchemaPayloadDto {
  @ApiProperty({
    type: [RagSchemaTableDto],
    description: 'Lista de tabelas do schema',
  })
  tables: RagSchemaTableDto[];
}

export class RagRegisterSchemaRequestDto {
  @ApiProperty({
    description: 'Identificador único do banco de dados (ex.: nome do catálogo Trino)',
    example: 'supabase_targets',
    minLength: 1,
  })
  @IsString()
  @MinLength(1)
  database_id: string;

  @ApiProperty({
    description: 'Nome amigável do banco (opcional)',
    example: 'Frota (PostgreSQL)',
    required: false,
  })
  @IsOptional()
  @IsString()
  database_name?: string;

  @ApiProperty({
    description: 'Schema com tabelas e colunas',
  })
  @IsObject()
  schema: RagSchemaPayloadDto;

  @ApiProperty({
    description: 'Versão do schema (opcional)',
    example: '1.0.0',
    required: false,
  })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiProperty({
    description: 'Metadados adicionais (opcional)',
    required: false,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class RagRegisterSchemaResponseDto {
  @ApiProperty({ description: 'Identificador do banco de dados' })
  database_id: string;

  @ApiProperty({ description: 'Data/hora de registro' })
  registered_at: string;

  @ApiProperty({ description: 'Versão do schema', required: false })
  version?: string;

  @ApiProperty({ description: 'Indica se o registro foi bem-sucedido' })
  success: boolean;
}
