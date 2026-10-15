import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  CreateExcuseSchema,
  CreateHomeworkSchema,
  DecideExcuseSchema,
  ListExcusesQuerySchema,
  ListHomeworkQuerySchema,
  ListNotificationsQuerySchema,
  MarkNotificationsReadSchema,
  ScheduleQuerySchema,
  UpdateHomeworkTaskSchema,
  type CreateExcuseInput,
  type CreateHomeworkInput,
  type DecideExcuseInput,
  type ListExcusesQuery,
  type ListHomeworkQuery,
  type ListNotificationsQuery,
  type MarkNotificationsReadInput,
  type ScheduleQuery,
  type UpdateHomeworkTaskInput,
} from '@ribat/shared';
import type { AuditContext } from '../audit/audit-context';
import { CurrentAudit, CurrentOrg, OrgRoute, type OrgContext } from '../auth/org-context.guard';
import { createZodValidationPipe } from '../common/zod-validation.pipe';
import { OutboxService } from '../events/outbox.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ExcusesService } from './excuses.service';
import { HomeworkService } from './homework.service';
import { PortalService } from './portal.service';

const id = new ParseUUIDPipe();

/** S4: the family portal, excuses, homework, the inbox and failed event deliveries. */
@Controller()
export class FamiliesController {
  constructor(
    private readonly portal: PortalService,
    private readonly excuses: ExcusesService,
    private readonly homework: HomeworkService,
    private readonly notifications: NotificationsService,
    private readonly outbox: OutboxService,
  ) {}

  @Get('schedule')
  @OrgRoute()
  schedule(
    @CurrentOrg() org: OrgContext,
    @Query(createZodValidationPipe(ScheduleQuerySchema)) query: ScheduleQuery,
  ) {
    return this.portal.schedule(org, query);
  }

  @Get('members/:id/progress')
  @OrgRoute()
  progress(@CurrentOrg() org: OrgContext, @Param('id', id) memberId: string) {
    return this.portal.progress(org, memberId);
  }

  // Excuses (WF-08)

  @Get('excuses')
  @OrgRoute()
  listExcuses(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Query(createZodValidationPipe(ListExcusesQuerySchema)) query: ListExcusesQuery,
  ) {
    return this.excuses.list(org, audit, query);
  }

  @Post('excuses')
  @OrgRoute()
  submitExcuse(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Body(createZodValidationPipe(CreateExcuseSchema)) body: CreateExcuseInput,
  ) {
    return this.excuses.create(org, audit, body);
  }

  @Post('excuses/:id/decision')
  @OrgRoute('members.manage')
  decideExcuse(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Param('id', id) excuseId: string,
    @Body(createZodValidationPipe(DecideExcuseSchema)) body: DecideExcuseInput,
  ) {
    return this.excuses.decide(org, audit, excuseId, body.decision);
  }

  // Homework (decision 10.2)

  @Get('homework')
  @OrgRoute()
  listHomework(
    @CurrentOrg() org: OrgContext,
    @Query(createZodValidationPipe(ListHomeworkQuerySchema)) query: ListHomeworkQuery,
  ) {
    return this.homework.list(org, query.courseId);
  }

  @Post('homework')
  @OrgRoute()
  assignHomework(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Body(createZodValidationPipe(CreateHomeworkSchema)) body: CreateHomeworkInput,
  ) {
    return this.homework.create(org, audit, body);
  }

  @Get('homework/:id/tasks')
  @OrgRoute()
  homeworkTasks(@CurrentOrg() org: OrgContext, @Param('id', id) homeworkId: string) {
    return this.homework.tasks(org, homeworkId);
  }

  @Patch('homework/tasks/:id')
  @HttpCode(204)
  @OrgRoute()
  async markTask(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Param('id', id) taskId: string,
    @Body(createZodValidationPipe(UpdateHomeworkTaskSchema)) body: UpdateHomeworkTaskInput,
  ) {
    await this.homework.mark(org, audit, taskId, body.status);
  }

  // Notifications (T406)

  @Get('notifications')
  @OrgRoute()
  inbox(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Query(createZodValidationPipe(ListNotificationsQuerySchema)) query: ListNotificationsQuery,
  ) {
    return this.notifications.list(org.organizationId, audit.actorIdentityId!, query);
  }

  @Post('notifications/read')
  @HttpCode(204)
  @OrgRoute()
  async markRead(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Body(createZodValidationPipe(MarkNotificationsReadSchema)) body: MarkNotificationsReadInput,
  ) {
    await this.notifications.markRead(org.organizationId, audit.actorIdentityId!, body);
  }

  // Failed event deliveries (T411, EV-05)

  @Get('events/failed')
  @OrgRoute('audit.read')
  failedDeliveries(@CurrentOrg() org: OrgContext) {
    return this.outbox.listFailed(org.organizationId);
  }

  @Post('events/deliveries/:id/retry')
  @HttpCode(204)
  @OrgRoute('audit.read')
  async retryDelivery(@CurrentOrg() org: OrgContext, @Param('id', id) deliveryId: string) {
    await this.outbox.retry(org.organizationId, deliveryId);
  }
}
