import { Injectable } from '@nestjs/common';
import type { Course, Enrollment } from '@prisma/client';
import type { OrgContext } from '../auth/org-context.guard';
import { forbidden, notFound } from '../common/errors';
import {
  assertWritable,
  CourseAccessService,
} from '../courses/course-access.service';
import { ALL_MATERIALS } from '../courses/groups.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Who may read or write class data for one course.
 * `groupIds` is null when every enrollment is in reach (staff, or a course without groups);
 * otherwise it lists the groups this teacher leads, possibly none.
 */
export type ClassScope = {
  course: Course;
  staff: boolean;
  groupIds: string[] | null;
};

/** Staff are the ADMIN-view holders of `courses.manage`; the API answers member view as a member (PERM-06). */
export const isStaffContext = (org: OrgContext) =>
  org.permissions.includes('courses.manage');

/**
 * PERM-11, computed on every request and on every replayed mutation (PERM-12):
 * an active TeachingAssignment on the course, and — when groups are on — a group they lead.
 */
@Injectable()
export class ClassScopeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CourseAccessService,
  ) {}

  async forCourse(
    org: OrgContext,
    courseId: string,
    mode: 'read' | 'write',
  ): Promise<ClassScope> {
    const course = await this.access.find(org.organizationId, courseId);
    if (mode === 'write') assertWritable(course);
    if (isStaffContext(org)) return { course, staff: true, groupIds: null };

    const assignment = await this.access.activeAssignment(
      org.organizationId,
      courseId,
      org.memberId,
    );
    if (!assignment) throw forbidden('You do not teach this course');
    if (!(course.isHierarchical && course.hasGroups))
      return { course, staff: false, groupIds: null };

    const groups = await this.prisma
      .forOrganization(org.organizationId)
      .courseGroup.findMany({
        where: { courseId, teacherMemberId: org.memberId! },
        select: { id: true },
      });
    return { course, staff: false, groupIds: groups.map((g) => g.id) };
  }

  /** Enrollments in reach, for rosters and kits. */
  enrollmentFilter(scope: ClassScope) {
    return {
      courseId: scope.course.id,
      status: 'ACTIVE' as const,
      ...(scope.groupIds
        ? { groupMembers: { some: { groupId: { in: scope.groupIds } } } }
        : {}),
    };
  }

  /**
   * The enrollment exists in this course and sits in one of the teacher's groups —
   * for `materialId`, a group for that material or for all materials (DM-06).
   */
  async assertStudent(
    org: OrgContext,
    scope: ClassScope,
    enrollmentId: string,
    materialId?: string,
  ): Promise<Enrollment> {
    const db = this.prisma.forOrganization(org.organizationId);
    const enrollment = await db.enrollment.findFirst({
      where: { id: enrollmentId, courseId: scope.course.id, status: 'ACTIVE' },
    });
    if (!enrollment) throw notFound('Enrollment');
    if (!scope.groupIds) return enrollment;

    const inGroup = await db.groupMember.findFirst({
      where: {
        enrollmentId,
        groupId: { in: scope.groupIds },
        ...(materialId
          ? { materialKey: { in: [materialId, ALL_MATERIALS] } }
          : {}),
      },
    });
    if (!inGroup) throw forbidden('This student is not in your group');
    return enrollment;
  }
}
