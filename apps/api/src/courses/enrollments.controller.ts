import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  CreateRequirementSchema,
  EnrollSchema,
  type CreateRequirementInput,
  type EnrollInput,
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
import { EnrollmentsService } from './enrollments.service';

const id = new ParseUUIDPipe();

/** Teachers cannot enroll or move students (WF-04 rules); they may read their roster. */
@Controller('courses/:id')
export class EnrollmentsController {
  constructor(
    private readonly enrollments: EnrollmentsService,
    private readonly access: CourseAccessService,
  ) {}

  @Get('requirements')
  @OrgRoute('courses.manage')
  listRequirements(
    @CurrentOrg() org: OrgContext,
    @Param('id', id) courseId: string,
  ) {
    return this.enrollments.listRequirements(org.organizationId, courseId);
  }

  @Post('requirements')
  @OrgRoute('courses.manage')
  addRequirement(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Param('id', id) courseId: string,
    @Body(createZodValidationPipe(CreateRequirementSchema))
    body: CreateRequirementInput,
  ) {
    return this.enrollments.addRequirement(
      org.organizationId,
      courseId,
      body,
      audit,
    );
  }

  @Delete('requirements/:requirementId')
  @OrgRoute('courses.manage')
  @HttpCode(204)
  async removeRequirement(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Param('id', id) courseId: string,
    @Param('requirementId', id) requirementId: string,
  ) {
    await this.enrollments.removeRequirement(
      org.organizationId,
      courseId,
      requirementId,
      audit,
    );
  }

  @Get('enrollments')
  @OrgRoute()
  async list(@CurrentOrg() org: OrgContext, @Param('id', id) courseId: string) {
    await this.access.forStaffOrTeacher(org, courseId);
    return this.enrollments.list(org.organizationId, courseId);
  }

  @Post('enrollments')
  @OrgRoute('courses.manage')
  enroll(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Param('id', id) courseId: string,
    @Body(createZodValidationPipe(EnrollSchema)) body: EnrollInput,
  ) {
    return this.enrollments.enroll(
      org.organizationId,
      courseId,
      body.memberId,
      audit,
    );
  }

  @Delete('enrollments/:enrollmentId')
  @OrgRoute('courses.manage')
  @HttpCode(204)
  async withdraw(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Param('id', id) courseId: string,
    @Param('enrollmentId', id) enrollmentId: string,
  ) {
    await this.enrollments.withdraw(
      org.organizationId,
      courseId,
      enrollmentId,
      audit,
    );
  }
}
