import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { OpenRouterService } from './openrouter.service';

@Module({
  imports: [
    ConfigModule,
    HttpModule.register({
      timeout: 60000, // 60 segundos
      maxRedirects: 5,
    }),
  ],
  providers: [OpenRouterService],
  exports: [OpenRouterService],
})
export class OpenRouterModule {}
