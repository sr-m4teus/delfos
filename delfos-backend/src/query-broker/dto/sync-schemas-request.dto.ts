import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsArray, IsString } from 'class-validator';

export class SyncSchemasRequestDto {
  @ApiProperty({
    description:
      'Lista de catálogos Trino a sincronizar. Se omitido, sincroniza todos os catálogos (exceto system)',
    example: ['supabase_targets'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  catalogs?: string[];
}
