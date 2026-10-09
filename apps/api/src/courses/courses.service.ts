import { Injectable } from '@nestjs/common';
import type { Course, Prisma } from '@prisma/client';
import type {
  AddCourseMaterialInput,
  AddTeacherInput,
  CourseMaterialResponse,
  CourseResponse,
  CourseStatus,
  CreateCourseInput,
  ListCoursesQuery,
  MyCourseResponse,
  TeachingRole,
  TeachingAssignmentResponse,
  UpdateCourseInput,
} from '@ribat/shared';
import type { AuditContext } from '../audit/audit-context';
import { AuditService } from '../audit/audit.service';
import { badRequest, conflict, notFound } from '../common/errors';
import { dateIn, fromDateString } from '../common/zoned-time';
import { SessionsQueue } from '../jobs/sessions-queue';
import { toMaterialResponse } from '../materials/material.mapper';
import { MaterialsService } from '../materials/materials.service';
import { PrismaService } from '../prisma/prisma.service';
import { assertWritable, CourseAccessService } from './course-access.service';
import { memberName, toCourseResponse } from './course.mapper';
import { canTransition } from './lifecycle';

const optionalDate = (value: string | undefined) =>
  value === undefined ? undefined : fromDateString(value);

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: CourseAccessService,
    private readonly materials: MaterialsService,
    private readonly sessions: SessionsQueue,
  ) {}

  // -------------------------------------------------------------------------
  // Courses and lifecycle (T202)
  // -------------------------------------------------------------------------

  async list(
    organizationId: string,
    query: ListCoursesQuery,
  ): Promise<CourseResponse[]> {
    const rows = await this.prisma
      .forOrganization(organizationId)
      .course.findMany({
        where: {
          type: query.type,
          status: query.status ?? { not: 'ARCHIVED' },
        },
        orderBy: [{ name: 'asc' }],
      });
    return rows.map(toCourseResponse);
  }

  async get(organizationId: string, id: string): Promise<CourseResponse> {
    return toCourseResponse(await this.access.find(organizationId, id));
  }

  async create(
    organizationId: string,
    input: CreateCourseInput,
    auditCtx: AuditContext,
  ): Promise<CourseResponse> {
    const row = await this.prisma
      .forOrganization(organizationId)
      .course.create({
        data: {
          organizationId,
          ...input,
          startDate: optionalDate(input.startDate),
          endDate: optionalDate(input.endDate),
        },
      });
    await this.audit.record(auditCtx, {
      action: 'course.created',
      entityType: 'course',
      entityId: row.id,
      after: toCourseResponse(row),
    });
    return toCourseResponse(row);
  }

  async update(
    organizationId: string,
    id: string,
    input: UpdateCourseInput,
    auditCtx: AuditContext,
  ): Promise<CourseResponse> {
    const db = this.prisma.forOrganization(organizationId);
    const before = await this.access.writable(organizationId, id);
    await this.assertToggles(organizationId, before, input);

    await db.course.updateMany({
      where: { id },
      data: {
        ...input,
        startDate: optionalDate(input.startDate),
        endDate: optionalDate(input.endDate),
      },
    });
    const after = await this.access.find(organizationId, id);
    await this.audit.record(auditCtx, {
      action: 'course.updated',
      entityType: 'course',
      entityId: id,
      before: toCourseResponse(before),
      after: toCourseResponse(after),
    });
    if (input.startDate !== undefined || input.endDate !== undefined) {
      await this.sessions.generateCourse(organizationId, id);
    }
    return toCourseResponse(after);
  }

  /**
   * DM-07: toggle 1 (several teachers) and toggle 2 (groups) cannot be switched off while
   * something depends on them, and groups need several teachers.
   */
  private async assertToggles(
    organizationId: string,
    course: Course,
    input: UpdateCourseInput,
  ) {
    const db = this.prisma.forOrganization(organizationId);
    const hierarchical = input.isHierarchical ?? course.isHierarchical;
    const groups = input.hasGroups ?? course.hasGroups;
    if (groups && !hierarchical) {
      throw conflict(
        'Groups need several teachers: turn on the hierarchical option first',
      );
    }
    if (input.isHierarchical === false && course.isHierarchical) {
      const teachers = await db.teachingAssignment.count({
        where: { courseId: course.id, endedAt: null },
      });
      if (teachers > 1)
        throw conflict('Remove the extra teachers before turning this off');
    }
    if (
      (input.hasGroups === false || input.isHierarchical === false) &&
      course.hasGroups
    ) {
      const count = await db.courseGroup.count({
        where: { courseId: course.id },
      });
      if (count > 0)
        throw conflict('Delete the groups before turning this off');
    }
  }

  async changeStatus(
    organizationId: string,
    id: string,
    status: CourseStatus,
    auditCtx: AuditContext,
  ): Promise<CourseResponse> {
    const db = this.prisma.forOrganization(organizationId);
    const before = await this.access.find(organizationId, id);
    if (!canTransition(before.status, status)) {
      throw conflict(
        `A ${before.status.toLowerCase()} course cannot become ${status.toLowerCase()}`,
      );
    }

    await db.course.updateMany({ where: { id }, data: { status } });
    if (status === 'FINISHED') {
      // Finished means completed: COMPLETED_COURSE requirements read these rows.
      const settings =
        await this.prisma.platform.organization.findUniqueOrThrow({
          where: { id: organizationId },
        });
      await db.enrollment.updateMany({
        where: { courseId: id, status: 'ACTIVE' },
        data: {
          status: 'COMPLETED',
          endedAt: fromDateString(dateIn(new Date(), settings.timezone)),
        },
      });
    }
    await this.audit.record(auditCtx, {
      action: 'course.status_changed',
      entityType: 'course',
      entityId: id,
      before: { status: before.status },
      after: { status },
    });
    // ACTIVE generates sessions; PAUSED / FINISHED / ARCHIVED clear future ones.
    await this.sessions.generateCourse(organizationId, id);
    return toCourseResponse(await this.access.find(organizationId, id));
  }

  // -------------------------------------------------------------------------
  // Course materials (T201 + OQ-3)
  // -------------------------------------------------------------------------

  async listMaterials(
    organizationId: string,
    courseId: string,
  ): Promise<CourseMaterialResponse[]> {
    const rows = await this.prisma
      .forOrganization(organizationId)
      .courseMaterial.findMany({
        where: { courseId },
        include: { material: true },
        orderBy: [{ order: 'asc' }],
      });
    return rows.map((row) => ({
      id: row.id,
      courseId: row.courseId,
      materialId: row.materialId,
      track: row.track,
      order: row.order,
      material: toMaterialResponse(row.material),
    }));
  }

  async addMaterial(
    organizationId: string,
    course: Course,
    input: AddCourseMaterialInput,
    auditCtx: AuditContext,
  ): Promise<CourseMaterialResponse[]> {
    const allowed = course.type === 'BOTH' || course.type === input.track;
    if (!allowed) badRequestTrack(course.type);

    const materialId = input.newMaterial
      ? (
          await this.materials.create(
            organizationId,
            input.newMaterial,
            auditCtx,
          )
        ).id
      : (await this.materials.findActive(organizationId, input.materialId!)).id;

    const db = this.prisma.forOrganization(organizationId);
    const existing = await db.courseMaterial.findFirst({
      where: { courseId: course.id, materialId },
    });
    if (existing) throw conflict('This material is already on the course');

    const order =
      input.order ??
      (await db.courseMaterial.count({ where: { courseId: course.id } }));
    const row = await db.courseMaterial.create({
      data: {
        organizationId,
        courseId: course.id,
        materialId,
        track: input.track,
        order,
      },
    });
    await this.audit.record(auditCtx, {
      action: 'course_material.added',
      entityType: 'course_material',
      entityId: row.id,
      after: { courseId: course.id, materialId, track: input.track },
    });
    return this.listMaterials(organizationId, course.id);
  }

  async removeMaterial(
    organizationId: string,
    course: Course,
    materialId: string,
    auditCtx: AuditContext,
  ): Promise<void> {
    const db = this.prisma.forOrganization(organizationId);
    const link = await db.courseMaterial.findFirst({
      where: { courseId: course.id, materialId },
    });
    if (!link) throw notFound('Course material');
    if (
      await db.courseGroup.count({ where: { courseId: course.id, materialId } })
    ) {
      throw conflict(
        'A group teaches this material; delete or change that group first',
      );
    }
    await db.courseMaterial.deleteMany({ where: { id: link.id } });
    await this.audit.record(auditCtx, {
      action: 'course_material.removed',
      entityType: 'course_material',
      entityId: link.id,
      before: { courseId: course.id, materialId },
    });
  }

  // -------------------------------------------------------------------------
  // Teachers (T205)
  // -------------------------------------------------------------------------

  async listTeachers(
    organizationId: string,
    courseId: string,
  ): Promise<TeachingAssignmentResponse[]> {
    const rows = await this.prisma
      .forOrganization(organizationId)
      .teachingAssignment.findMany({
        where: { courseId },
        include: { teacher: true },
        orderBy: [
          { endedAt: { sort: 'desc', nulls: 'first' } },
          { role: 'asc' },
          { createdAt: 'asc' },
        ],
      });
    return rows.map((row) => ({
      id: row.id,
      courseId: row.courseId,
      teacherMemberId: row.teacherMemberId,
      teacherName: memberName(row.teacher),
      role: row.role,
      createdAt: row.createdAt.toISOString(),
      endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    }));
  }

  /**
   * The first active teacher is the lead. A second one needs the hierarchical toggle.
   * Asking for LEAD hands the lead over; the old lead stays as a teacher.
   */
  async addTeacher(
    organizationId: string,
    courseId: string,
    input: AddTeacherInput,
    auditCtx: AuditContext,
  ): Promise<TeachingAssignmentResponse[]> {
    const course = await this.access.writable(organizationId, courseId);
    const db = this.prisma.forOrganization(organizationId);
    const member = await db.member.findFirst({
      where: { id: input.memberId, status: 'ACTIVE' },
    });
    if (!member) throw notFound('Member');

    const active = await db.teachingAssignment.findMany({
      where: { courseId, endedAt: null },
    });
    const current = active.find((a) => a.teacherMemberId === member.id);
    if (!current && active.length >= 1 && !course.isHierarchical) {
      throw conflict(
        'Turn on "several teachers" for this course to add a second teacher',
      );
    }
    const soleTeacher =
      active.length === 0 || (active.length === 1 && current !== undefined);
    const role: TeachingRole = soleTeacher
      ? 'LEAD'
      : (input.role ?? current?.role ?? 'TEACHER');
    if (current?.role === 'LEAD' && role === 'TEACHER') {
      throw conflict('Make another teacher the lead first');
    }

    await db.$transaction(async (tx) => {
      if (role === 'LEAD') {
        await tx.teachingAssignment.updateMany({
          where: {
            courseId,
            endedAt: null,
            role: 'LEAD',
            teacherMemberId: { not: member.id },
          },
          data: { role: 'TEACHER' },
        });
      }
      const existing = await tx.teachingAssignment.findFirst({
        where: { courseId, teacherMemberId: member.id },
      });
      if (existing) {
        await tx.teachingAssignment.updateMany({
          where: { id: existing.id },
          data: { role, endedAt: null },
        });
      } else {
        await tx.teachingAssignment.create({
          data: { organizationId, courseId, teacherMemberId: member.id, role },
        });
      }
    });
    await this.audit.record(auditCtx, {
      action: 'teacher.assigned',
      entityType: 'course',
      entityId: courseId,
      after: { teacherMemberId: member.id, role },
    });
    return this.listTeachers(organizationId, courseId);
  }

  /** History is kept (decision 5.5): removing sets endedAt. */
  async removeTeacher(
    organizationId: string,
    courseId: string,
    memberId: string,
    auditCtx: AuditContext,
  ): Promise<TeachingAssignmentResponse[]> {
    await this.access.writable(organizationId, courseId);
    const db = this.prisma.forOrganization(organizationId);
    const assignment = await db.teachingAssignment.findFirst({
      where: { courseId, teacherMemberId: memberId, endedAt: null },
    });
    if (!assignment) throw notFound('Teacher');
    if (
      await db.courseGroup.count({
        where: { courseId, teacherMemberId: memberId },
      })
    ) {
      throw conflict(
        'This teacher leads a group; give the group to another teacher first',
      );
    }
    const others = await db.teachingAssignment.count({
      where: { courseId, endedAt: null, id: { not: assignment.id } },
    });
    if (assignment.role === 'LEAD' && others > 0) {
      throw conflict('Make another teacher the lead first');
    }
    await db.teachingAssignment.updateMany({
      where: { id: assignment.id },
      data: { endedAt: new Date() },
    });
    await this.audit.record(auditCtx, {
      action: 'teacher.removed',
      entityType: 'course',
      entityId: courseId,
      before: { teacherMemberId: memberId, role: assignment.role },
    });
    return this.listTeachers(organizationId, courseId);
  }

  /** PERM-03: the courses a member teaches. Archived courses drop off. */
  async myCourses(
    organizationId: string,
    memberId: string | null,
  ): Promise<MyCourseResponse[]> {
    if (!memberId) return [];
    const rows = await this.prisma
      .forOrganization(organizationId)
      .teachingAssignment.findMany({
        where: {
          teacherMemberId: memberId,
          endedAt: null,
          course: { status: { not: 'ARCHIVED' } },
        },
        include: { course: true },
        orderBy: {
          course: { name: 'asc' },
        } satisfies Prisma.TeachingAssignmentOrderByWithRelationInput,
      });
    return rows.map((row) => ({
      ...toCourseResponse(row.course),
      teachingRole: row.role,
    }));
  }

  assertWritable(course: Course): void {
    assertWritable(course);
  }
}

function badRequestTrack(type: Course['type']): never {
  throw badRequest(
    'track',
    type === 'MEMORIZATION'
      ? 'A memorization course only takes memorization materials'
      : 'An explanation course only takes explanation materials',
  );
}
