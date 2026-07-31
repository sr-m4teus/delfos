import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrinoModule } from '../trino/trino.module';
import { TableNode } from './entities/table-node.entity';
import { TableFkEdge } from './entities/table-fk-edge.entity';
import { QueryBrokerController } from './query-broker.controller';
import { SchemaController } from './schema.controller';
import { QueryBrokerService } from './services/query-broker.service';
import { QueryAnalyzerService } from './services/query-analyzer.service';
import { RagOrchestratorClientService } from './services/rag-orchestrator-client.service';
import { SchemaSyncService } from './services/schema-sync.service';
import { DependencyGraphService } from './services/dependency-graph.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([TableNode, TableFkEdge]),
    HttpModule.register({
      timeout: 30000, // 30 segundos
      maxRedirects: 5,
    }),
    TrinoModule,
  ],
  controllers: [QueryBrokerController, SchemaController],
  providers: [
    QueryBrokerService,
    QueryAnalyzerService,
    RagOrchestratorClientService,
    SchemaSyncService,
    DependencyGraphService,
  ],
  exports: [QueryBrokerService, RagOrchestratorClientService],
})
export class QueryBrokerModule {}
