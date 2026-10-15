import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoursesModule } from '../courses/courses.module';
import { ClassScopeService } from './class-scope.service';
import { ProgressController } from './progress.controller';
import { ProgressReaderService } from './progress-reader.service';
import { ProgressWriterService } from './progress-writer.service';

/** S3: attendance, memorization, explanation logs, the class kit and offline replay. */
@Module({
  imports: [AuthModule, CoursesModule],
  controllers: [ProgressController],
  providers: [ClassScopeService, ProgressReaderService, ProgressWriterService],
  exports: [ClassScopeService],
})
export class ProgressModule {}
