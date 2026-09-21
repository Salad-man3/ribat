import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module.js';
import { RedisService } from './redis.service.js';

@Module({
  imports: [ConfigModule],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
