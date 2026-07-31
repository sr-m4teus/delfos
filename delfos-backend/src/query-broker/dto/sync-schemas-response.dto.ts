import { ApiProperty } from '@nestjs/swagger';

export class SyncedCatalogDto {
  @ApiProperty({
    description: 'Identificador do banco/catálogo',
    example: 'supabase_targets',
  })
  database_id: string;

  @ApiProperty({
    description: 'Indica se o registro no RAG foi bem-sucedido',
    example: true,
  })
  success: boolean;
}

export class SyncSchemaErrorDto {
  @ApiProperty({
    description: 'Identificador do banco/catálogo que falhou',
    example: 'supabase_targets',
  })
  database_id: string;

  @ApiProperty({
    description: 'Mensagem de erro',
    example: 'Erro ao registrar schema no RAG',
  })
  message: string;
}

export class SyncSchemasResponseDto {
  @ApiProperty({
    description: 'Catálogos registrados com sucesso no RAG',
    type: [SyncedCatalogDto],
  })
  synced: SyncedCatalogDto[];

  @ApiProperty({
    description: 'Erros por catálogo (se houver)',
    type: [SyncSchemaErrorDto],
    required: false,
  })
  errors?: SyncSchemaErrorDto[];
}
