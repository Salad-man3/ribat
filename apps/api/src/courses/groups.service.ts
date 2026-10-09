import { Injectable } from '@nestjs/common';
import type {
  CourseGroup,
  GroupMember,
  Material,
  Member,
} from '@prisma/client';
import type {
  CreateGroupInput,
  GroupResponse,
  UpdateGroupInput,
} from '@ribat/shared';
import type { AuditContext } from '../audit/audit-context';
import { AuditService } from '../audit/audit.service';
import { conflict, isUniqueViolation, notFound } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { CourseAccessService } from './course-access.service';
import { memberName } from './course.mapper';

export const ALL_MATERIALS = 'ALL';

type GroupRow = CourseGroup & {
  teacher: Member;
  material: Material | null;
  members: GroupMember[];
};

function toGroupResponse(row: GroupRow): GroupResponse {
  return {
    id: row.id,
    courseId: row.courseId,
    name: row.name,
    teacherMemberId: row.teacherMemberId,
    teacherName: memberName(row.teacher),
    materialId: row.materialId,
    materialTitle: row.material?.title ?? null,
    enrollmentIds: row.members.map((m) => m.enrollmentId),
  };
}

const include = { teacher: true, material: true, members: true } as const;

/**
 * T206. DM-06 — at most one teacher per material per student — is enforced by the
 * database: GroupMember carries the group's materialKey through a composite FK and
 * (enrollmentId, materialKey) is unique. The service only adds the case keys cannot
 * express: an "all materials" group overlapping a single-material group.
 */
@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: CourseAccessService,
  ) {}

  async list(
    organizationId: string,
    courseId: string,
  ): Promise<GroupResponse[]> {
    await this.access.find(organizationId, courseId);
    const rows = await this.prisma
      .forOrganization(organizationId)
      .courseGroup.findMany({
        where: { courseId },
        include,
        orderBy: { name: 'asc' },
      });
    return rows.map(toGroupResponse);
  }

  private async groupsAllowed(organizationId: string, courseId: string) {
    const course = await this.access.writable(organizationId, courseId);
    if (!course.isHierarchical || !course.hasGroups) {
      throw conflict(
        'Turn on several teachers and groups for this course first',
      );
    }
    return course;
  }

  private async assertTeacher(
    organizationId: string,
    courseId: string,
    memberId: string,
  ) {
    if (
      !(await this.access.activeAssignment(organizationId, courseId, memberId))
    ) {
      throw conflict('The group teacher must be one of the course teachers');
    }
  }

  private async findGroup(
    organizationId: string,
    courseId: string,
    groupId: string,
  ): Promise<GroupRow> {
    const row = await this.prisma
      .forOrganization(organizationId)
      .courseGroup.findFirst({
        where: { id: groupId, courseId },
        include,
      });
    if (!row) throw notFound('Group');
    return row;
  }

  async create(
    organizationId: string,
    courseId: string,
    input: CreateGroupInput,
    auditCtx: AuditContext,
  ): Promise<GroupResponse> {
    await this.groupsAllowed(organizationId, courseId);
    await this.assertTeacher(organizationId, courseId, input.teacherMemberId);
    const db = this.prisma.forOrganization(organizationId);
    if (input.materialId) {
      const onCourse = await db.courseMaterial.findFirst({
        where: { courseId, materialId: input.materialId },
      });
      if (!onCourse) throw conflict('Add this material to the course first');
    }
    const row = await db.courseGroup.create({
      data: {
        organizationId,
        courseId,
        name: input.name,
        teacherMemberId: input.teacherMemberId,
        materialId: input.materialId ?? null,
        materialKey: input.materialId ?? ALL_MATERIALS,
      },
    });
    await this.audit.record(auditCtx, {
      action: 'group.created',
      entityType: 'course_group',
      entityId: row.id,
      after: {
        courseId,
        name: row.name,
        teacherMemberId: row.teacherMemberId,
        materialId: row.materialId,
      },
    });
    return toGroupResponse(
      await this.findGroup(organizationId, courseId, row.id),
    );
  }

  async update(
    organizationId: string,
    courseId: string,
    groupId: string,
    input: UpdateGroupInput,
    auditCtx: AuditContext,
  ): Promise<GroupResponse> {
    await this.groupsAllowed(organizationId, courseId);
    const before = await this.findGroup(organizationId, courseId, groupId);
    if (input.teacherMemberId)
      await this.assertTeacher(organizationId, courseId, input.teacherMemberId);
    await this.prisma
      .forOrganization(organizationId)
      .courseGroup.updateMany({ where: { id: groupId }, data: input });
    await this.audit.record(auditCtx, {
      action: 'group.updated',
      entityType: 'course_group',
      entityId: groupId,
      before: { name: before.name, teacherMemberId: before.teacherMemberId },
      after: input,
    });
    return toGroupResponse(
      await this.findGroup(organizationId, courseId, groupId),
    );
  }

  async remove(
    organizationId: string,
    courseId: string,
    groupId: string,
    auditCtx: AuditContext,
  ): Promise<void> {
    await this.access.writable(organizationId, courseId);
    const group = await this.findGroup(organizationId, courseId, groupId);
    // GroupMember rows go with it (ON DELETE CASCADE).
    await this.prisma
      .forOrganization(organizationId)
      .courseGroup.deleteMany({ where: { id: groupId } });
    await this.audit.record(auditCtx, {
      action: 'group.deleted',
      entityType: 'course_group',
      entityId: groupId,
      before: {
        name: group.name,
        enrollmentIds: group.members.map((m) => m.enrollmentId),
      },
    });
  }

  async addStudent(
    organizationId: string,
    courseId: string,
    groupId: string,
    enrollmentId: string,
    auditCtx: AuditContext,
  ): Promise<GroupResponse> {
    await this.groupsAllowed(organizationId, courseId);
    const group = await this.findGroup(organizationId, courseId, groupId);
    const db = this.prisma.forOrganization(organizationId);
    const enrollment = await db.enrollment.findFirst({
      where: { id: enrollmentId, courseId, status: 'ACTIVE' },
    });
    if (!enrollment) throw notFound('Enrollment');

    // "All materials" overlaps every single-material group, and the other way round.
    const overlapping = await db.groupMember.findFirst({
      where: {
        enrollmentId,
        groupId: { not: groupId },
        ...(group.materialKey === ALL_MATERIALS
          ? {}
          : { materialKey: ALL_MATERIALS }),
      },
    });
    if (overlapping) throw oneTeacherPerMaterial();

    try {
      await db.groupMember.create({
        data: {
          organizationId,
          groupId,
          materialKey: group.materialKey,
          enrollmentId,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw oneTeacherPerMaterial();
      throw error;
    }
    await this.audit.record(auditCtx, {
      action: 'group_member.added',
      entityType: 'course_group',
      entityId: groupId,
      after: { enrollmentId },
    });
    return toGroupResponse(
      await this.findGroup(organizationId, courseId, groupId),
    );
  }

  async removeStudent(
    organizationId: string,
    courseId: string,
    groupId: string,
    enrollmentId: string,
    auditCtx: AuditContext,
  ): Promise<GroupResponse> {
    await this.access.writable(organizationId, courseId);
    await this.findGroup(organizationId, courseId, groupId);
    const { count } = await this.prisma
      .forOrganization(organizationId)
      .groupMember.deleteMany({ where: { groupId, enrollmentId } });
    if (!count) throw notFound('Group student');
    await this.audit.record(auditCtx, {
      action: 'group_member.removed',
      entityType: 'course_group',
      entityId: groupId,
      before: { enrollmentId },
    });
    return toGroupResponse(
      await this.findGroup(organizationId, courseId, groupId),
    );
  }
}

function oneTeacherPerMaterial() {
  return conflict(
    'This student already has a teacher for this material (DM-06)',
  );
}
