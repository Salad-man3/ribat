import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  CreatePauseSchema,
  ListSessionsQuerySchema,
  PutScheduleSchema,
  type CreatePauseInput,
  type ListSessionsQuery,
  type PutScheduleInput,
} from '@ribat/shared';
import type { AuditContext } from '../audit/audit-context';
import {
  CurrentAudit,
  CurrentOrg,
  OrgRoute,
  type OrgContext,
} from '../auth/org-context.guard';
import { createZodValidationPipe } from '../common/zod-validation.pipe';
import { CourseAccessService } from './course-access.service';
import { ScheduleService } from './schedule.service';

const id = new ParseUUIDPipe();

/** Editing the schedule and pausing are staff-only (permission matrix); teachers can read. */
@Controller('courses/:id')
export class ScheduleController {
  constructor(
    private readonly schedule: ScheduleService,
    private readonly access: CourseAccessService,
  ) {}

  @Get('schedule')
  @OrgRoute()
  async getSchedule(
    @CurrentOrg() org: OrgContext,
    @Param('id', id) courseId: string,
  ) {
    await this.access.forStaffOrTeacher(org, courseId);
    return this.schedule.getSchedule(org.organizationId, courseId);
  }

  @Put('schedule')
  @OrgRoute('courses.manage')
  putSchedule(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Param('id', id) courseId: string,
    @Body(createZodValidationPipe(PutScheduleSchema)) body: PutScheduleInput,
  ) {
    return this.schedule.putSchedule(
      org.organizationId,
      courseId,
      body.rules,
      audit,
    );
  }

  @Get('pauses')
  @OrgRoute()
  async listPauses(
    @CurrentOrg() org: OrgContext,
    @Param('id', id) courseId: string,
  ) {
    await this.access.forStaffOrTeacher(org, courseId);
    return this.schedule.listPauses(org.organizationId, courseId);
  }

  @Post('pauses')
  @OrgRoute('courses.manage')
  addPause(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Param('id', id) courseId: string,
    @Body(createZodValidationPipe(CreatePauseSchema)) body: CreatePauseInput,
  ) {
    return this.schedule.addPause(org.organizationId, courseId, body, audit);
  }

  @Delete('pauses/:pauseId')
  @OrgRoute('courses.manage')
  @HttpCode(204)
  async removePause(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Param('id', id) courseId: string,
    @Param('pauseId', id) pauseId: string,
  ) {
    await this.schedule.removePause(
      org.organizationId,
      courseId,
      pauseId,
      audit,
    );
  }

  @Get('sessions')
  @OrgRoute()
  async listSessions(
    @CurrentOrg() org: OrgContext,
    @Param('id', id) courseId: string,
    @Query(createZodValidationPipe(ListSessionsQuerySchema))
    query: ListSessionsQuery,
  ) {
    await this.access.forStaffOrTeacher(org, courseId);
    return this.schedule.listSessions(org.organizationId, courseId, query);
  }
}
