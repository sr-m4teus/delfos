import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { QueryBrokerService } from './services/query-broker.service';
import { AnalyzeQueryRequestDto } from './dto/analyze-query-request.dto';
import { AnalyzeQueryResponseDto } from './dto/analyze-query-response.dto';

@ApiTags('query-broker')
@Controller('api/query-broker')
export class QueryBrokerController {
  private readonly logger = new Logger(QueryBrokerController.name);

  constructor(private readonly queryBrokerService: QueryBrokerService) {}

  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Analisar consulta em linguagem natural',
    description:
      'Analisa uma consulta em linguagem natural, extrai componentes (entidades, ações, filtros) e busca contexto relevante do RAG Orchestrator',
  })
  @ApiResponse({
    status: 200,
    description: 'Análise da consulta realizada com sucesso',
    type: AnalyzeQueryResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Requisição inválida',
  })
  @ApiResponse({
    status: 500,
    description: 'Erro interno do servidor',
  })
  async analyzeQuery(
    @Body() request: AnalyzeQueryRequestDto,
  ): Promise<AnalyzeQueryResponseDto> {
    this.logger.log(
      `Recebida requisição de análise: ${request.natural_language_query.substring(0, 50)}...`,
    );

    // Validar consulta
    const validation = this.queryBrokerService.validateQuery(
      request.natural_language_query,
    );
    if (!validation.valid) {
      throw new BadRequestException(validation.reason);
    }

    // Processar análise
    const result = await this.queryBrokerService.analyzeQuery(request);

    this.logger.log(
      `Análise concluída: ${result.components.entities.length} entidades identificadas`,
    );

    return result;
  }
}
