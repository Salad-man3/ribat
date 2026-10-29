import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoursesModule } from '../courses/courses.module';
import { FamiliesModule } from '../families/families.module';
import { StatsController } from './stats.controller';
import { StatsJobsModule } from './stats-jobs.module';
import { StatsService } from './stats.service';

@Module({
  imports: [AuthModule, CoursesModule, StatsJobsModule, forwardRef(() => FamiliesModule)],
  controllers: [StatsController],
  providers: [StatsService],
  exports: [StatsService],
})
export class StatsModule {}
