import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CustomFieldsModule } from '../custom-fields/custom-fields.module';
import { MaterialsModule } from '../materials/materials.module';
import { CourseAccessService } from './course-access.service';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from './enrollments.service';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';
import { SessionGeneratorService } from './session-generator.service';

@Module({
  imports: [AuthModule, MaterialsModule, CustomFieldsModule],
  controllers: [
    CoursesController,
    EnrollmentsController,
    GroupsController,
    ScheduleController,
  ],
  providers: [
    CourseAccessService,
    CoursesService,
    EnrollmentsService,
    GroupsService,
    ScheduleService,
    SessionGeneratorService,
  ],
  exports: [SessionGeneratorService, CourseAccessService],
})
export class CoursesModule {}
