import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class ValidateQueryRequestDto {
  @ApiProperty({
    description: 'Query SQL a ser validada',
    example: 'SELECT * FROM customers WHERE total > 1000',
    maxLength: 10000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000, { message: 'Query muito longa (máximo 10000 caracteres)' })
  sql_query: string;

  @ApiProperty({
    description: 'ID do usuário que está validando (opcional, para logs)',
    required: false,
  })
  user_id?: string;
}
