import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    this.client = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
      db: this.configService.get<number>('REDIS_DB', 0),
      tls:
        this.configService.get<string>('REDIS_TLS') === 'true' ? {} : undefined,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    this.client.on('connect', () => {
      console.log('Redis Client Connected');
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  getClient(): Redis {
    return this.client;
  }

  async setSession(userId: string, token: string): Promise<void> {
    const prefix = this.configService.get<string>('SESSION_PREFIX', 'delfos:sess:');
    const ttl = this.configService.get<number>('SESSION_TTL', 3600);
    const key = `${prefix}${userId}`;
    await this.client.setex(key, ttl, token);
  }

  async checkSession(userId: string): Promise<boolean> {
    const prefix = this.configService.get<string>('SESSION_PREFIX', 'delfos:sess:');
    const key = `${prefix}${userId}`;
    const exists = await this.client.exists(key);
    return exists === 1;
  }

  async deleteSession(userId: string): Promise<void> {
    const prefix = this.configService.get<string>('SESSION_PREFIX', 'delfos:sess:');
    const key = `${prefix}${userId}`;
    await this.client.del(key);
  }

  async getSession(userId: string): Promise<string | null> {
    const prefix = this.configService.get<string>('SESSION_PREFIX', 'delfos:sess:');
    const key = `${prefix}${userId}`;
    return this.client.get(key);
  }
}
