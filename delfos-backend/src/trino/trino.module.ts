import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { TrinoClientService } from './services/trino-client.service';

@Module({
  imports: [
    ConfigModule,
    HttpModule.register({
      timeout: 60000, // 60 segundos padrão
      maxRedirects: 5,
    }),
  ],
  providers: [TrinoClientService],
  exports: [TrinoClientService],
})
export class TrinoModule {}
