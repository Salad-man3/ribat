import { Injectable } from '@nestjs/common';
import type { Course, TeachingAssignment } from '@prisma/client';
import type { OrgContext } from '../auth/org-context.guard';
import { conflict, forbidden, notFound } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { isWritable } from './lifecycle';

/**
 * Staff manage every course (`courses.manage`). A teacher's capabilities come from an
 * active TeachingAssignment on that one course (PERM-03), never from a global role.
 * Order matters for DM-02: a course outside the org is 404 before any 403.
 */
@Injectable()
export class CourseAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async find(organizationId: string, courseId: string): Promise<Course> {
    const course = await this.prisma
      .forOrganization(organizationId)
      .course.findFirst({ where: { id: courseId } });
    if (!course) throw notFound('Course');
    return course;
  }

  async activeAssignment(
    organizationId: string,
    courseId: string,
    memberId: string | null,
  ): Promise<TeachingAssignment | null> {
    if (!memberId) return null;
    return this.prisma
      .forOrganization(organizationId)
      .teachingAssignment.findFirst({
        where: { courseId, teacherMemberId: memberId, endedAt: null },
      });
  }

  /** Staff, or a teacher of this course. */
  async forStaffOrTeacher(org: OrgContext, courseId: string): Promise<Course> {
    const course = await this.find(org.organizationId, courseId);
    if (org.permissions.includes('courses.manage')) return course;
    if (await this.activeAssignment(org.organizationId, courseId, org.memberId))
      return course;
    throw forbidden();
  }

  /** OQ-3: material changes on a course — staff with materials.manage, or its teachers. */
  async forMaterialChange(org: OrgContext, courseId: string): Promise<Course> {
    const course = await this.find(org.organizationId, courseId);
    const allowed =
      org.permissions.includes('materials.manage') ||
      (await this.activeAssignment(
        org.organizationId,
        courseId,
        org.memberId,
      )) !== null;
    if (!allowed) throw forbidden();
    assertWritable(course);
    return course;
  }

  async writable(organizationId: string, courseId: string): Promise<Course> {
    const course = await this.find(organizationId, courseId);
    assertWritable(course);
    return course;
  }
}

export function assertWritable(course: Course): void {
  if (!isWritable(course.status))
    throw conflict('This course is finished and read-only');
}
