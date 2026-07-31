import { ApiProperty } from '@nestjs/swagger';

export class MarkSuccessResponseDto {
  @ApiProperty({
    description: 'Indica se a marcação foi bem-sucedida',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'ID da consulta validada no RAG Orchestrator',
    example: 'query_abc123',
    required: false,
  })
  query_id?: string;

  @ApiProperty({
    description: 'Mensagem de confirmação',
    example: 'Consulta marcada como bem-sucedida',
  })
  message: string;
}
