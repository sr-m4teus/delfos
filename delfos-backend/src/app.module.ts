import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RedisModule } from './redis/redis.module';
import { QueryBrokerModule } from './query-broker/query-broker.module';
import { SqlParserModule } from './sql-parser/sql-parser.module';
import { DelfosModule } from './delfos/delfos.module';
import { User } from './users/entities/user.entity';
import { TableNode } from './query-broker/entities/table-node.entity';
import { TableFkEdge } from './query-broker/entities/table-fk-edge.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('POSTGRES_HOST', 'localhost'),
        port: configService.get<number>('POSTGRES_PORT', 5432),
        username: configService.get<string>('POSTGRES_USER', 'delfos_user'),
        password: configService.get<string>('POSTGRES_PASSWORD', 'delfos_password'),
        database: configService.get<string>('POSTGRES_DB', 'delfos'),
        schema: configService.get<string>('DB_SCHEMA', 'delfos'),
        entities: [User, TableNode, TableFkEdge],
        synchronize: configService.get<string>('NODE_ENV') === 'development',
        logging: configService.get<string>('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    RedisModule,
    UsersModule,
    AuthModule,
    QueryBrokerModule,
    SqlParserModule,
    DelfosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
