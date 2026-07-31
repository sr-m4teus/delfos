import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({
    description: 'Identificador único do usuário',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Email do usuário (único)',
    example: 'usuario@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'Nome completo do usuário',
    example: 'João Silva',
  })
  name: string;

  @ApiProperty({
    description: 'Tipo de usuário',
    enum: ['common', 'db-manager', 'admin'],
    example: 'common',
  })
  userType: 'common' | 'db-manager' | 'admin';

  @ApiProperty({
    description: 'Data de criação da conta',
    example: '2025-01-27T10:00:00Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Data da última atualização',
    example: '2025-01-27T10:00:00Z',
  })
  updatedAt: string;
}
