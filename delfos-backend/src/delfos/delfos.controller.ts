import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Logger,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminOnlyGuard } from './guards/admin-only.guard';
import { DelfosService } from './delfos.service';
import { TranslateQueryRequestDto } from './dto/translate-query-request.dto';
import { TranslateQueryResponseDto } from './dto/translate-query-response.dto';
import { ValidateEditRequestDto } from './dto/validate-edit-request.dto';
import { ValidateEditResponseDto } from './dto/validate-edit-response.dto';
import { ExecuteQueryRequestDto } from './dto/execute-query-request.dto';
import { ExecuteQueryResponseDto } from './dto/execute-query-response.dto';
import { MarkSuccessRequestDto } from './dto/mark-success-request.dto';
import { MarkSuccessResponseDto } from './dto/mark-success-response.dto';
import { QueryHistoryListResponseDto } from './dto/query-history-response.dto';

@ApiTags('delfos')
@ApiBearerAuth()
@Controller('api/delfos')
@UseGuards(JwtAuthGuard)
export class DelfosController {
  private readonly logger = new Logger(DelfosController.name);

  constructor(private readonly delfosService: DelfosService) {}

  @Post('translate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Traduz consulta em linguagem natural para SQL',
    description:
      'Traduz uma consulta em linguagem natural para SQL federado validado, usando QueryBroker, RAG Orchestrator, OpenRouter e QueryValidator',
  })
  @ApiResponse({
    status: 200,
    description: 'Consulta traduzida com sucesso',
    type: TranslateQueryResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Query inválida ou rejeitada pelo validador',
  })
  @ApiResponse({
    status: 401,
    description: 'Não autenticado',
  })
  async translateQuery(
    @Body() request: TranslateQueryRequestDto,
  ): Promise<TranslateQueryResponseDto> {
    this.logger.log(
      `Requisição de tradução recebida: ${request.natural_language_query.substring(0, 50)}...`,
    );
    return this.delfosService.translateQuery(request);
  }

  @Post('validate-edit')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminOnlyGuard)
  @ApiOperation({
    summary: 'Valida query editada pelo usuário',
    description:
      'Valida uma query SQL editada por um administrador. Apenas administradores podem editar queries.',
  })
  @ApiResponse({
    status: 200,
    description: 'Query validada',
    type: ValidateEditResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Apenas administradores podem editar queries',
  })
  @ApiResponse({
    status: 401,
    description: 'Não autenticado',
  })
  async validateEdit(
    @Body() request: ValidateEditRequestDto,
  ): Promise<ValidateEditResponseDto> {
    this.logger.log(
      `Requisição de validação de edição recebida: ${request.sql_query.substring(0, 50)}...`,
    );
    return this.delfosService.validateEditedQuery(request);
  }

  @Get('query-history')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Histórico de consultas bem-sucedidas',
    description:
      'Lista consultas registradas no RAG para o usuário autenticado (JWT sub)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de itens de histórico',
    type: QueryHistoryListResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Não autenticado',
  })
  async getQueryHistory(
    @Request() req: { user: { sub: string } },
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<QueryHistoryListResponseDto> {
    return this.delfosService.getQueryHistory(req.user.sub, limit);
  }

  @Post('execute')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Executa query SQL no Trino',
    description:
      'Executa uma query SQL validada no Trino e retorna os resultados',
  })
  @ApiResponse({
    status: 200,
    description: 'Query executada com sucesso',
    type: ExecuteQueryResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Query inválida ou erro na execução',
  })
  @ApiResponse({
    status: 401,
    description: 'Não autenticado',
  })
  async executeQuery(
    @Request() req: { user: { sub: string } },
    @Body() request: ExecuteQueryRequestDto,
  ): Promise<ExecuteQueryResponseDto> {
    this.logger.log(
      `Requisição de execução recebida: ${request.sql_query.substring(0, 50)}...`,
    );
    return this.delfosService.executeQuery(request, req.user.sub);
  }

  @Post('mark-success')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Marca consulta como bem-sucedida',
    description:
      'Marca uma consulta como bem-sucedida no RAG Orchestrator para aprendizado contínuo',
  })
  @ApiResponse({
    status: 200,
    description: 'Consulta marcada como bem-sucedida',
    type: MarkSuccessResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Não autenticado',
  })
  async markSuccess(
    @Request() req: { user: { sub: string } },
    @Body() request: MarkSuccessRequestDto,
  ): Promise<MarkSuccessResponseDto> {
    this.logger.log(
      `Marcando consulta como bem-sucedida: ${request.natural_language_query.substring(0, 50)}...`,
    );
    return this.delfosService.markQueryAsSuccess(request, req.user.sub);
  }
}
