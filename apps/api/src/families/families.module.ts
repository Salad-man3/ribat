import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OutboxService } from '../events/outbox.service';
import { StatsJobsModule } from '../stats/stats-jobs.module';
import { EveningService } from '../notifications/evening.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ProgressModule } from '../progress/progress.module';
import { ExcusesService } from './excuses.service';
import { FamiliesController } from './families.controller';
import { HomeworkService } from './homework.service';
import { MemberAccessService } from './member-access.service';
import { PortalService } from './portal.service';
import { AwqafService } from './awqaf.service';

/** S4: families, homework, notifications, and the event outbox that feeds them (ADR-0009). */
@Module({
  imports: [AuthModule, ProgressModule, StatsJobsModule],
  controllers: [FamiliesController],
  exports: [MemberAccessService],
  providers: [
    MemberAccessService,
    ExcusesService,
    HomeworkService,
    PortalService,
    AwqafService,
    NotificationsService,
    EveningService,
    OutboxService,
  ],
})
export class FamiliesModule {}
