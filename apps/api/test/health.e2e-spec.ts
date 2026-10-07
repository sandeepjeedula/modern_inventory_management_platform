import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import * as request from 'supertest';
import { HealthController } from '../src/health/health.controller';

describe('Health API', () => {
  let app: INestApplication;
  const dataSource = { query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
  const redis = { ping: jest.fn().mockResolvedValue('PONG') };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: DataSource, useValue: dataSource },
        { provide: Redis, useValue: redis },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => app?.close());

  it('exposes liveness without leaking dependency details', async () => {
    await request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('exposes dependency readiness', async () => {
    await request(app.getHttpServer())
      .get('/api/health/ready')
      .expect(200)
      .expect({ status: 'ok', dependencies: { postgres: 'ok', redis: 'ok' } });
  });
});
