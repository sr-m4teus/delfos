import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class MarkSuccessRequestDto {
  @ApiProperty({
    description: 'Consulta original em linguagem natural',
    example: 'Mostre todos os clientes que compraram mais de 1000 reais este mês',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  natural_language_query: string;

  @ApiProperty({
    description: 'Query SQL executada com sucesso',
    example: 'SELECT * FROM customers WHERE total > 1000',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  sql_query: string;

  @ApiProperty({
    description: 'Contexto utilizado na tradução (opcional)',
    required: false,
  })
  context?: {
    schemas?: any[];
    queries?: any[];
  };
}
