import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { SessionsQueue } from './sessions-queue';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [SessionsQueue],
  exports: [SessionsQueue],
})
export class JobsQueueModule {}
