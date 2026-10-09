import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { CoursesModule } from '../courses/courses.module';
import { SessionsWorker } from './sessions.worker';

@Module({
  imports: [ConfigModule, CoursesModule],
  providers: [SessionsWorker],
})
export class JobsModule {}
