import { ApiProperty } from '@nestjs/swagger';

export class OpenRouterChoiceDto {
  @ApiProperty({
    description: 'Índice da escolha',
    example: 0,
  })
  index: number;

  @ApiProperty({
    description: 'Mensagem da resposta',
    type: 'object',
    properties: {
      role: { type: 'string', example: 'assistant' },
      content: { type: 'string', example: 'SELECT * FROM customers WHERE total > 1000' },
    },
  })
  message: {
    role: string;
    content: string;
  };

  @ApiProperty({
    description: 'Razão de término',
    example: 'stop',
  })
  finish_reason: string;
}

export class OpenRouterUsageDto {
  @ApiProperty({
    description: 'Tokens de prompt usados',
    example: 150,
  })
  prompt_tokens: number;

  @ApiProperty({
    description: 'Tokens de conclusão usados',
    example: 50,
  })
  completion_tokens: number;

  @ApiProperty({
    description: 'Total de tokens usados',
    example: 200,
  })
  total_tokens: number;
}

export class OpenRouterResponseDto {
  @ApiProperty({
    description: 'ID da resposta',
    example: 'gen-abc123',
  })
  id: string;

  @ApiProperty({
    description: 'Modelo usado',
    example: 'openai/gpt-4o-mini',
  })
  model: string;

  @ApiProperty({
    description: 'Array de escolhas',
    type: [OpenRouterChoiceDto],
  })
  choices: OpenRouterChoiceDto[];

  @ApiProperty({
    description: 'Uso de tokens',
    type: OpenRouterUsageDto,
  })
  usage: OpenRouterUsageDto;

  @ApiProperty({
    description: 'Tipo de objeto',
    example: 'chat.completion',
  })
  object: string;

  @ApiProperty({
    description: 'Timestamp de criação',
    example: 1234567890,
  })
  created: number;
}
