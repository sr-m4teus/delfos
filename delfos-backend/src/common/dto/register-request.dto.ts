import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MatchPassword } from '../validators/match-password.validator';

export class RegisterRequestDto {
  @ApiProperty({
    description: 'Email do usuário (deve ser único)',
    example: 'novo@example.com',
  })
  @IsEmail({}, { message: 'Email deve ter um formato válido' })
  @IsNotEmpty({ message: 'Email é obrigatório' })
  email: string;

  @ApiProperty({
    description: 'Senha do usuário',
    example: 'senha123',
    minLength: 6,
  })
  @IsString({ message: 'Senha deve ser uma string' })
  @IsNotEmpty({ message: 'Senha é obrigatória' })
  @MinLength(6, { message: 'Senha deve ter no mínimo 6 caracteres' })
  password: string;

  @ApiProperty({
    description: 'Confirmação de senha (deve ser igual a password)',
    example: 'senha123',
  })
  @IsString({ message: 'Confirmação de senha deve ser uma string' })
  @IsNotEmpty({ message: 'Confirmação de senha é obrigatória' })
  @MatchPassword('password', { message: 'Confirmação de senha não confere' })
  passwordConfirmation: string;

  @ApiProperty({
    description: 'Nome completo do usuário',
    example: 'Maria Santos',
    minLength: 2,
    maxLength: 100,
  })
  @IsString({ message: 'Nome deve ser uma string' })
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  @MinLength(2, { message: 'Nome deve ter no mínimo 2 caracteres' })
  @MaxLength(100, { message: 'Nome deve ter no máximo 100 caracteres' })
  name: string;
}
