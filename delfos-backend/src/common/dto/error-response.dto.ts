import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({
    description: 'Código do erro',
    enum: [
      'INVALID_CREDENTIALS',
      'EMAIL_ALREADY_EXISTS',
      'VALIDATION_ERROR',
      'SESSION_EXPIRED',
      'UNAUTHORIZED',
      'FORBIDDEN',
      'SERVER_ERROR',
      'NETWORK_ERROR',
    ],
    example: 'INVALID_CREDENTIALS',
  })
  error: string;

  @ApiProperty({
    description: 'Mensagem de erro amigável em português',
    example: 'Email ou senha incorretos',
  })
  message: string;

  @ApiProperty({
    description: 'Detalhes de validação por campo (opcional)',
    example: {
      email: ['Email é obrigatório'],
      password: ['Senha deve ter no mínimo 6 caracteres'],
    },
    required: false,
  })
  details?: Record<string, string[]>;
}
