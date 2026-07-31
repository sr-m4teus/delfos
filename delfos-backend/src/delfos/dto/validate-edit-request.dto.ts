import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';

export class ValidateEditRequestDto {
  @ApiProperty({
    description: 'Query SQL editada pelo usuário',
    example: 'SELECT id, name, total FROM customers WHERE total > 1000 ORDER BY total DESC',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  sql_query: string;

  @ApiProperty({
    description: 'Consulta original em linguagem natural (para contexto)',
    example: 'Mostre todos os clientes que compraram mais de 1000 reais este mês',
    required: false,
  })
  @IsOptional()
  @IsString()
  natural_language_query?: string;
}
