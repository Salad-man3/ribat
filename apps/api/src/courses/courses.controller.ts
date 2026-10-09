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
  Query,
} from '@nestjs/common';
import {
  AddCourseMaterialSchema,
  AddTeacherSchema,
  ChangeCourseStatusSchema,
  CreateCourseSchema,
  ListCoursesQuerySchema,
  UpdateCourseSchema,
  type AddCourseMaterialInput,
  type AddTeacherInput,
  type ChangeCourseStatusInput,
  type CreateCourseInput,
  type ListCoursesQuery,
  type UpdateCourseInput,
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
import { CoursesService } from './courses.service';

const id = new ParseUUIDPipe();

@Controller()
export class CoursesController {
  constructor(
    private readonly courses: CoursesService,
    private readonly access: CourseAccessService,
  ) {}

  /** PERM-03: the courses the caller teaches (member view, teachers). */
  @Get('me/courses')
  @OrgRoute()
  myCourses(@CurrentOrg() org: OrgContext) {
    return this.courses.myCourses(org.organizationId, org.memberId);
  }

  @Get('courses')
  @OrgRoute('courses.manage')
  list(
    @CurrentOrg() org: OrgContext,
    @Query(createZodValidationPipe(ListCoursesQuerySchema))
    query: ListCoursesQuery,
  ) {
    return this.courses.list(org.organizationId, query);
  }

  @Post('courses')
  @OrgRoute('courses.manage')
  create(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Body(createZodValidationPipe(CreateCourseSchema)) body: CreateCourseInput,
  ) {
    return this.courses.create(org.organizationId, body, audit);
  }

  /** Teachers may open their own course. */
  @Get('courses/:id')
  @OrgRoute()
  async get(@CurrentOrg() org: OrgContext, @Param('id', id) courseId: string) {
    await this.access.forStaffOrTeacher(org, courseId);
    return this.courses.get(org.organizationId, courseId);
  }

  @Patch('courses/:id')
  @OrgRoute('courses.manage')
  update(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Param('id', id) courseId: string,
    @Body(createZodValidationPipe(UpdateCourseSchema)) body: UpdateCourseInput,
  ) {
    return this.courses.update(org.organizationId, courseId, body, audit);
  }

  @Post('courses/:id/status')
  @OrgRoute('courses.manage')
  changeStatus(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Param('id', id) courseId: string,
    @Body(createZodValidationPipe(ChangeCourseStatusSchema))
    body: ChangeCourseStatusInput,
  ) {
    return this.courses.changeStatus(
      org.organizationId,
      courseId,
      body.status,
      audit,
    );
  }

  // Materials: staff with materials.manage, or a teacher of the course (OQ-3).

  @Get('courses/:id/materials')
  @OrgRoute()
  async listMaterials(
    @CurrentOrg() org: OrgContext,
    @Param('id', id) courseId: string,
  ) {
    await this.access.forStaffOrTeacher(org, courseId);
    return this.courses.listMaterials(org.organizationId, courseId);
  }

  @Post('courses/:id/materials')
  @OrgRoute()
  async addMaterial(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Param('id', id) courseId: string,
    @Body(createZodValidationPipe(AddCourseMaterialSchema))
    body: AddCourseMaterialInput,
  ) {
    const course = await this.access.forMaterialChange(org, courseId);
    return this.courses.addMaterial(org.organizationId, course, body, audit);
  }

  @Delete('courses/:id/materials/:materialId')
  @OrgRoute()
  @HttpCode(204)
  async removeMaterial(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Param('id', id) courseId: string,
    @Param('materialId', id) materialId: string,
  ) {
    const course = await this.access.forMaterialChange(org, courseId);
    await this.courses.removeMaterial(
      org.organizationId,
      course,
      materialId,
      audit,
    );
  }

  // Teachers (T205). Assigning is staff-only; teachers may see who teaches with them.

  @Get('courses/:id/teachers')
  @OrgRoute()
  async listTeachers(
    @CurrentOrg() org: OrgContext,
    @Param('id', id) courseId: string,
  ) {
    await this.access.forStaffOrTeacher(org, courseId);
    return this.courses.listTeachers(org.organizationId, courseId);
  }

  @Post('courses/:id/teachers')
  @OrgRoute('courses.manage')
  addTeacher(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Param('id', id) courseId: string,
    @Body(createZodValidationPipe(AddTeacherSchema)) body: AddTeacherInput,
  ) {
    return this.courses.addTeacher(org.organizationId, courseId, body, audit);
  }

  @Delete('courses/:id/teachers/:memberId')
  @OrgRoute('courses.manage')
  removeTeacher(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Param('id', id) courseId: string,
    @Param('memberId', id) memberId: string,
  ) {
    return this.courses.removeTeacher(
      org.organizationId,
      courseId,
      memberId,
      audit,
    );
  }
}
