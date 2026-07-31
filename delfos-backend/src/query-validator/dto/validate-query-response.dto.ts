import { ApiProperty } from '@nestjs/swagger';

export class ValidateQueryResponseDto {
  @ApiProperty({
    description: 'Indica se a query é válida',
    example: true,
  })
  valid: boolean;

  @ApiProperty({
    description: 'Razão da validação (erro se inválida, sucesso se válida)',
    example: 'Query válida',
    required: false,
  })
  reason?: string;

  @ApiProperty({
    description: 'Lista de avisos (não bloqueiam a execução)',
    example: ['Query pode ser otimizada'],
    required: false,
  })
  warnings?: string[];

  @ApiProperty({
    description: 'Detalhes adicionais da validação',
    required: false,
  })
  details?: {
    detected_patterns?: string[];
    blocked_commands?: string[];
    allowed_operations?: string[];
  };
}
