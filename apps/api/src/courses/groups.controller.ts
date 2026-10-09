import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  AddGroupStudentSchema,
  CreateGroupSchema,
  UpdateGroupSchema,
  type AddGroupStudentInput,
  type CreateGroupInput,
  type UpdateGroupInput,
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
import { GroupsService } from './groups.service';

const id = new ParseUUIDPipe();

@Controller('courses/:id/groups')
export class GroupsController {
  constructor(
    private readonly groups: GroupsService,
    private readonly access: CourseAccessService,
  ) {}

  @Get()
  @OrgRoute()
  async list(@CurrentOrg() org: OrgContext, @Param('id', id) courseId: string) {
    await this.access.forStaffOrTeacher(org, courseId);
    return this.groups.list(org.organizationId, courseId);
  }

  @Post()
  @OrgRoute('courses.manage')
  create(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Param('id', id) courseId: string,
    @Body(createZodValidationPipe(CreateGroupSchema)) body: CreateGroupInput,
  ) {
    return this.groups.create(org.organizationId, courseId, body, audit);
  }

  @Patch(':groupId')
  @OrgRoute('courses.manage')
  update(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Param('id', id) courseId: string,
    @Param('groupId', id) groupId: string,
    @Body(createZodValidationPipe(UpdateGroupSchema)) body: UpdateGroupInput,
  ) {
    return this.groups.update(
      org.organizationId,
      courseId,
      groupId,
      body,
      audit,
    );
  }

  @Delete(':groupId')
  @OrgRoute('courses.manage')
  @HttpCode(204)
  async remove(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Param('id', id) courseId: string,
    @Param('groupId', id) groupId: string,
  ) {
    await this.groups.remove(org.organizationId, courseId, groupId, audit);
  }

  @Post(':groupId/students')
  @OrgRoute('courses.manage')
  addStudent(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Param('id', id) courseId: string,
    @Param('groupId', id) groupId: string,
    @Body(createZodValidationPipe(AddGroupStudentSchema))
    body: AddGroupStudentInput,
  ) {
    return this.groups.addStudent(
      org.organizationId,
      courseId,
      groupId,
      body.enrollmentId,
      audit,
    );
  }

  @Delete(':groupId/students/:enrollmentId')
  @OrgRoute('courses.manage')
  removeStudent(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Param('id', id) courseId: string,
    @Param('groupId', id) groupId: string,
    @Param('enrollmentId', id) enrollmentId: string,
  ) {
    return this.groups.removeStudent(
      org.organizationId,
      courseId,
      groupId,
      enrollmentId,
      audit,
    );
  }
}
