import { Module } from '@nestjs/common';
import { QueryValidatorService } from './services/query-validator.service';

@Module({
  providers: [QueryValidatorService],
  exports: [QueryValidatorService],
})
export class QueryValidatorModule {}
