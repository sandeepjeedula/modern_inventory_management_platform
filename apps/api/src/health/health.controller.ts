import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redis: Redis,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiResponse({ status: 200, description: 'The API process is alive.' })
  liveness() {
    return { status: 'ok' as const };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Dependency readiness probe' })
  @ApiResponse({ status: 200, description: 'Required data services are reachable.' })
  @ApiResponse({ status: 503, description: 'A required data service is unavailable.' })
  async readiness() {
    const checks = await Promise.allSettled([
      this.dataSource.query('SELECT 1'),
      this.redis.ping(),
    ]);
    const [postgres, redis] = checks.map((check) => check.status === 'fulfilled');
    const result = {
      status: postgres && redis ? 'ok' : 'unavailable',
      dependencies: { postgres: postgres ? 'ok' : 'unavailable', redis: redis ? 'ok' : 'unavailable' },
    };

    if (!postgres || !redis) {
      throw new ServiceUnavailableException(result);
    }

    return result;
  }
}
