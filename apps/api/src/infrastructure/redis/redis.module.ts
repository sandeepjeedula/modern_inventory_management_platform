import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Global()
@Module({
  providers: [
    {
      provide: Redis,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new Redis(config.getOrThrow<string>('REDIS_URL'), {
        lazyConnect: false,
        maxRetriesPerRequest: 1,
        retryStrategy: (attempt) => Math.min(attempt * 250, 2_000),
      }),
    },
  ],
  exports: [Redis],
})
export class RedisModule {}
