import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly redis: RedisService,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string) {
    const indicator = this.healthIndicatorService.check(key);
    try {
      const pong = await this.redis.ping();
      if (pong !== 'PONG') {
        return indicator.down({ message: `unexpected ping response: ${pong}` });
      }
      return indicator.up();
    } catch (error) {
      return indicator.down({ message: error instanceof Error ? error.message : 'unknown' });
    }
  }
}
