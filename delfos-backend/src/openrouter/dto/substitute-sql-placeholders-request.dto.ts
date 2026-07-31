import { ApiProperty } from '@nestjs/swagger';
import { SchemaContextDto } from './translate-query-request.dto';

export class SubstituteSqlPlaceholdersRequestDto {
  @ApiProperty({
    description: 'Pergunta do usuário em linguagem natural (valores a inferir)',
    example: 'Usuários com nome Fulano de Tal',
  })
  natural_language_query: string;

  @ApiProperty({
    description:
      'SQL template com placeholders [PARAM_1], [PARAM_2], ... retornado pelo RAG',
    example: "SELECT * FROM dbo.usuarios u WHERE u.name = [PARAM_1]",
  })
  template_sql: string;

  @ApiProperty({
    description: 'Modelo LLM opcional',
    required: false,
  })
  model?: string;

  @ApiProperty({
    description:
      'Catálogo completo de schemas (mesmo envio da tradução) para validar nomes de tabelas/colunas',
    type: [SchemaContextDto],
    required: false,
  })
  schemas?: SchemaContextDto[];
}
