import { ApiProperty } from '@nestjs/swagger';

export class FilterDto {
  @ApiProperty({
    description: 'Campo ou atributo do filtro',
    example: 'valor',
  })
  field: string;

  @ApiProperty({
    description: 'Operador do filtro',
    example: '>',
    enum: ['>', '<', '>=', '<=', '=', '!=', 'LIKE', 'IN', 'BETWEEN'],
  })
  operator: string;

  @ApiProperty({
    description: 'Valor do filtro',
    example: '1000',
  })
  value: string | number | string[];

  @ApiProperty({
    description: 'Texto original do filtro na consulta',
    example: 'mais de 1000 reais',
  })
  originalText: string;
}

export class RelationshipDto {
  @ApiProperty({
    description: 'Entidade origem do relacionamento',
    example: 'clientes',
  })
  fromEntity: string;

  @ApiProperty({
    description: 'Entidade destino do relacionamento',
    example: 'compras',
  })
  toEntity: string;

  @ApiProperty({
    description: 'Tipo de relacionamento',
    example: 'has_many',
    enum: ['has_one', 'has_many', 'belongs_to', 'many_to_many'],
  })
  type: string;

  @ApiProperty({
    description: 'Confiança no relacionamento identificado',
    example: 0.8,
    minimum: 0,
    maximum: 1,
  })
  confidence: number;
}

export class QueryComponentsDto {
  @ApiProperty({
    description: 'Tabelas/entidades identificadas na consulta',
    example: ['clientes', 'compras'],
    type: [String],
  })
  entities: string[];

  @ApiProperty({
    description: 'Ações identificadas (SELECT, COUNT, SUM, etc.)',
    example: ['SELECT', 'COUNT'],
    type: [String],
  })
  actions: string[];

  @ApiProperty({
    description: 'Filtros e condições extraídos',
    type: [FilterDto],
  })
  filters: FilterDto[];

  @ApiProperty({
    description: 'Agregações identificadas',
    example: ['SUM', 'AVG', 'COUNT'],
    type: [String],
  })
  aggregations: string[];

  @ApiProperty({
    description: 'Relacionamentos entre entidades',
    type: [RelationshipDto],
  })
  relationships: RelationshipDto[];

  @ApiProperty({
    description: 'Confiança na análise (0-1)',
    example: 0.85,
    minimum: 0,
    maximum: 1,
  })
  confidence: number;
}
