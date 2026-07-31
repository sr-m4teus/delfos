import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SchemaSyncService } from './services/schema-sync.service';
import { DependencyGraphService } from './services/dependency-graph.service';
import { SyncSchemasRequestDto } from './dto/sync-schemas-request.dto';
import { SyncSchemasResponseDto } from './dto/sync-schemas-response.dto';
import { ListSchemasResponseDto } from './dto/list-schemas-response.dto';
import {
  DependencyGraphRequestDto,
  DependencyGraphResponseDto,
} from './dto/dependency-graph.dto';

@ApiTags('schemas')
@Controller('api/schemas')
@UseGuards(JwtAuthGuard)
export class SchemaController {
  private readonly logger = new Logger(SchemaController.name);

  constructor(
    private readonly schemaSyncService: SchemaSyncService,
    private readonly dependencyGraphService: DependencyGraphService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Listar schemas do Trino',
    description:
      'Retorna a lista de catálogos e tabelas (com colunas) disponíveis no Trino, sem registrar no RAG',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de bancos com tabelas e colunas',
    type: ListSchemasResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Erro ao comunicar com Trino',
  })
  async list(): Promise<ListSchemasResponseDto> {
    this.logger.log('Requisição de listagem de schemas recebida');
    return this.schemaSyncService.listSchemas();
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sincronizar schemas Trino com o RAG',
    description:
      'Coleta os schemas dos catálogos do Trino (information_schema) e registra cada um no RAG Orchestrator para uso em contexto de tradução NL→SQL',
  })
  @ApiResponse({
    status: 200,
    description: 'Resumo da sincronização (sucessos e erros por catálogo)',
    type: SyncSchemasResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Erro ao comunicar com Trino ou RAG',
  })
  async sync(
    @Body() request?: SyncSchemasRequestDto,
  ): Promise<SyncSchemasResponseDto> {
    this.logger.log('Requisição de sincronização de schemas recebida');
    return this.schemaSyncService.syncSchemas({
      catalogs: request?.catalogs,
    });
  }

  @Post('dependency-graph')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Grafo de dependências (FK) por tabela',
    description:
      'Recebe FQNs exatos (catalog.schema.table) e retorna, por tabela, o grafo de dependências FK bidirecional com profundidade ≤2. Grafo vazio = tabela não existe; um único nó = sem FK.',
  })
  @ApiResponse({ status: 200, description: 'Dicionário FQN -> grafo' })
  async dependencyGraph(
    @Body() request: DependencyGraphRequestDto,
  ): Promise<DependencyGraphResponseDto> {
    this.logger.log(
      `Grafo de dependências solicitado para ${request.tables.length} tabela(s)`,
    );
    return this.dependencyGraphService.getGraphs(request.tables);
  }
}
