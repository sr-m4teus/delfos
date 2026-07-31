import { ApiProperty } from '@nestjs/swagger';

/**
 * Interface interna para mensagens do OpenRouter
 * Roles são construídos automaticamente no serviço - não expostos publicamente
 */
export interface OpenRouterMessage {
  content: string;
}

export class OpenRouterRequestDto {
  @ApiProperty({
    description: 'Modelo LLM a ser usado',
    example: 'openai/gpt-4o-mini',
    required: false,
  })
  model?: string;

  @ApiProperty({
    description: 'Array de mensagens para o chat',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        role: { type: 'string', enum: ['system', 'user', 'assistant'] },
        content: { type: 'string' },
      },
    },
  })
  messages: OpenRouterMessage[];

  @ApiProperty({
    description: 'Temperatura para geração (0-2)',
    example: 0.7,
    required: false,
  })
  temperature?: number;

  @ApiProperty({
    description: 'Número máximo de tokens na resposta',
    example: 2000,
    required: false,
  })
  max_tokens?: number;

  @ApiProperty({
    description: 'Sequências de parada',
    example: ['```'],
    required: false,
  })
  stop?: string[];

  @ApiProperty({
    description: 'Habilitar streaming',
    example: false,
    required: false,
  })
  stream?: boolean;

  @ApiProperty({
    description:
      'Lista ordenada de modelos para fallback. OpenRouter tenta na ordem quando um modelo falha, atinge rate limit ou fica indisponível.',
    example: [
      'openai/gpt-oss-120b:free',
      'meta-llama/llama-3.3-70b-instruct:free',
    ],
    required: false,
    type: [String],
  })
  models?: string[];
}
