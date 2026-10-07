import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const dataSource = { query: jest.fn() } as unknown as DataSource;
  const redis = { ping: jest.fn() } as unknown as Redis;
  const controller = new HealthController(dataSource, redis);

  beforeEach(() => jest.clearAllMocks());

  it('reports healthy dependencies when PostgreSQL and Redis respond', async () => {
    jest.mocked(dataSource.query).mockResolvedValue([{ '?column?': 1 }]);
    jest.mocked(redis.ping).mockResolvedValue('PONG');

    await expect(controller.readiness()).resolves.toEqual({
      status: 'ok',
      dependencies: { postgres: 'ok', redis: 'ok' },
    });
  });

  it('returns service unavailable when a required dependency rejects', async () => {
    jest.mocked(dataSource.query).mockRejectedValue(new Error('offline'));
    jest.mocked(redis.ping).mockResolvedValue('PONG');

    await expect(controller.readiness()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
