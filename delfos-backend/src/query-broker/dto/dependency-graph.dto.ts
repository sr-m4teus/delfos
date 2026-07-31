import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsString } from 'class-validator';
import type { GraphEdge } from '../dependency-graph.util';

export class DependencyGraphRequestDto {
  @ApiProperty({
    description:
      'Lista de FQNs exatos (catalog.schema.table). Nome não-FQN é tratado como inexistente.',
    example: ['supabase_targets.db_crm.cliente', 'supabase_targets.db_crm.contrato'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  tables: string[];
}

export interface DependencyGraphDto {
  nodes: string[];
  edges: GraphEdge[];
}

/** key = exact string the caller passed in `tables`. */
export type DependencyGraphResponseDto = Record<string, DependencyGraphDto>;
