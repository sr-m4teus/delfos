import { ApiProperty } from '@nestjs/swagger';

export class ValidateEditResponseDto {
  @ApiProperty({
    description: 'Indica se a query editada é válida',
    example: true,
  })
  valid: boolean;

  @ApiProperty({
    description: 'Razão da validação',
    example: 'Query válida',
    required: false,
  })
  reason?: string;

  @ApiProperty({
    description: 'Avisos de validação',
    example: ['Query pode ser otimizada'],
    required: false,
  })
  warnings?: string[];

  @ApiProperty({
    description: 'Detalhes da validação',
    required: false,
  })
  details?: {
    detected_patterns?: string[];
    blocked_commands?: string[];
  };
}
