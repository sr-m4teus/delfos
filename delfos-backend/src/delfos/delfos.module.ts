import { Module } from '@nestjs/common';
import { DelfosService } from './delfos.service';
import { DelfosController } from './delfos.controller';
import { QueryBrokerModule } from '../query-broker/query-broker.module';
import { OpenRouterModule } from '../openrouter/openrouter.module';
import { QueryValidatorModule } from '../query-validator/query-validator.module';
import { TrinoModule } from '../trino/trino.module';

@Module({
  imports: [
    QueryBrokerModule, // Exporta QueryBrokerService e RagOrchestratorClientService
    OpenRouterModule, // Exporta OpenRouterService
    QueryValidatorModule, // Exporta QueryValidatorService
    TrinoModule, // Exporta TrinoClientService
  ],
  controllers: [DelfosController],
  providers: [DelfosService],
  exports: [DelfosService],
})
export class DelfosModule {}
