import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerGuard } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validateEnvironment } from './config/environment';
import { HealthModule } from './health/health.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    RedisModule,
    AuthModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.getOrThrow<string>('DATABASE_HOST'),
        port: config.getOrThrow<number>('DATABASE_PORT'),
        username: config.getOrThrow<string>('DATABASE_USER'),
        password: config.getOrThrow<string>('DATABASE_PASSWORD'),
        database: config.getOrThrow<string>('DATABASE_NAME'),
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: false,
      }),
    }),
    HealthModule,
    CatalogModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
