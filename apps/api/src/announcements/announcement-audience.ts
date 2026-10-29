import type { Announcement, AnnouncementTargetType } from '@prisma/client';
import type { OrgContext } from '../auth/org-context.guard';
import { forbidden, notFound } from '../common/errors';
import { isStaffContext } from '../progress/class-scope.service';
import type { ClassScopeService } from '../progress/class-scope.service';
import type { OrgTx } from '../prisma/prisma.service';
import type { TagsService } from '../tags/tags.service';

type Db = Pick<
  OrgTx,
  | 'member'
  | 'membership'
  | 'enrollment'
  | 'courseGroup'
  | 'groupMember'
  | 'memberTag'
  | 'course'
  | 'program'
  | 'teachingAssignment'
  | 'announcement'
>;

export async function resolveAnnouncementMemberIds(
  db: Db,
  org: OrgContext,
  scope: ClassScopeService,
  tags: TagsService,
  targetType: AnnouncementTargetType,
  targetIds: string[],
): Promise<string[]> {
  const staff = isStaffContext(org);
  switch (targetType) {
    case 'EVERYONE': {
      if (!staff) throw forbidden('Only staff can message everyone');
      const rows = await db.member.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }
    case 'TAGS': {
      if (!staff) throw forbidden('Only staff can message by tag');
      if (!(await tags.tagsEnabled(org.organizationId))) {
        throw forbidden('Member tags are not enabled');
      }
      if (targetIds.length === 0) return [];
      const tagRows = await db.memberTag.findMany({
        where: { tagId: { in: targetIds }, member: { status: 'ACTIVE' } },
        select: { memberId: true },
      });
      return [...new Set(tagRows.map((r) => r.memberId))];
    }
    case 'COURSES': {
      if (targetIds.length === 0) return [];
      for (const courseId of targetIds) {
        if (!staff) await scope.forCourse(org, courseId, 'read');
        else {
          const course = await db.course.findFirst({ where: { id: courseId } });
          if (!course) throw notFound('Course');
        }
      }
      const enrollments = await db.enrollment.findMany({
        where: { courseId: { in: targetIds }, status: 'ACTIVE' },
        select: { memberId: true },
      });
      let memberIds = [...new Set(enrollments.map((e) => e.memberId))];
      if (!staff) {
        const allowed = new Set<string>();
        for (const courseId of targetIds) {
          const classScope = await scope.forCourse(org, courseId, 'read');
          const rows = await db.enrollment.findMany({
            where: scope.enrollmentFilter(classScope),
            select: { memberId: true },
          });
          for (const row of rows) allowed.add(row.memberId);
        }
        memberIds = memberIds.filter((id) => allowed.has(id));
      }
      return memberIds;
    }
    case 'GROUPS': {
      if (targetIds.length === 0) return [];
      const groups = await db.courseGroup.findMany({
        where: { id: { in: targetIds } },
        select: { id: true, courseId: true },
      });
      if (groups.length !== targetIds.length) throw notFound('Group');
      if (!staff) {
        for (const group of groups) {
          const classScope = await scope.forCourse(org, group.courseId, 'read');
          if (classScope.groupIds && !classScope.groupIds.includes(group.id)) {
            throw forbidden('This is not your group');
          }
        }
      }
      const links = await db.groupMember.findMany({
        where: {
          groupId: { in: targetIds },
          enrollment: { status: 'ACTIVE' },
        },
        include: { enrollment: { select: { memberId: true } } },
      });
      return [...new Set(links.map((l) => l.enrollment.memberId))];
    }
    case 'MEMBERS': {
      if (targetIds.length === 0) return [];
      const rows = await db.member.findMany({
        where: { id: { in: targetIds }, status: 'ACTIVE' },
        select: { id: true },
      });
      if (rows.length !== targetIds.length) throw notFound('Member');
      if (staff) return rows.map((r) => r.id);
      const allowed = new Set<string>();
      const assignments = await db.teachingAssignment.findMany({
        where: { teacherMemberId: org.memberId!, endedAt: null },
        select: { courseId: true },
      });
      for (const { courseId } of assignments) {
        const classScope = await scope.forCourse(org, courseId, 'read');
        const enrollments = await db.enrollment.findMany({
          where: {
            ...scope.enrollmentFilter(classScope),
            memberId: { in: targetIds },
          },
          select: { memberId: true },
        });
        for (const e of enrollments) allowed.add(e.memberId);
      }
      const filtered = targetIds.filter((id) => allowed.has(id));
      if (filtered.length !== targetIds.length) throw forbidden('Some members are outside your classes');
      return filtered;
    }
    case 'PROGRAMS': {
      if (!staff) throw forbidden('Only staff can message by program');
      if (targetIds.length === 0) return [];
      const programs = await db.program.findMany({
        where: { id: { in: targetIds } },
        select: { id: true },
      });
      if (programs.length !== targetIds.length) throw notFound('Program');
      const courses = await db.course.findMany({
        where: { programId: { in: targetIds } },
        select: { id: true },
      });
      const courseIds = courses.map((c) => c.id);
      if (courseIds.length === 0) return [];
      const enrollments = await db.enrollment.findMany({
        where: { courseId: { in: courseIds }, status: 'ACTIVE' },
        select: { memberId: true },
      });
      return [...new Set(enrollments.map((e) => e.memberId))];
    }
    case 'ROLES': {
      if (!staff) throw forbidden('Only staff can message by role');
      if (targetIds.length === 0) return [];
      const memberships = await db.membership.findMany({
        where: {
          role: { in: targetIds as ('SHEIKH' | 'ORG_ADMIN' | 'MEMBER' | 'GUARDIAN')[] },
          status: 'ACTIVE',
          memberId: { not: null },
        },
        select: { memberId: true },
      });
      return [
        ...new Set(
          memberships.map((m) => m.memberId).filter((id): id is string => id !== null),
        ),
      ];
    }
    default:
      return [];
  }
}

export function targetIdsFromAnnouncement(row: Announcement): string[] {
  const raw = row.targetIds;
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === 'string');
}

/** Re-resolve audience when the outbox delivers; authorization already happened at send time. */
export async function resolveAnnouncementMemberIdsForDelivery(
  db: Db,
  row: Announcement,
): Promise<string[]> {
  const targetIds = targetIdsFromAnnouncement(row);
  switch (row.targetType) {
    case 'EVERYONE': {
      const rows = await db.member.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }
    case 'TAGS': {
      if (targetIds.length === 0) return [];
      const tagRows = await db.memberTag.findMany({
        where: { tagId: { in: targetIds }, member: { status: 'ACTIVE' } },
        select: { memberId: true },
      });
      return [...new Set(tagRows.map((r) => r.memberId))];
    }
    case 'COURSES': {
      if (targetIds.length === 0) return [];
      const enrollments = await db.enrollment.findMany({
        where: { courseId: { in: targetIds }, status: 'ACTIVE' },
        select: { memberId: true },
      });
      return [...new Set(enrollments.map((e) => e.memberId))];
    }
    case 'GROUPS': {
      if (targetIds.length === 0) return [];
      const links = await db.groupMember.findMany({
        where: {
          groupId: { in: targetIds },
          enrollment: { status: 'ACTIVE' },
        },
        include: { enrollment: { select: { memberId: true } } },
      });
      return [...new Set(links.map((l) => l.enrollment.memberId))];
    }
    case 'MEMBERS': {
      if (targetIds.length === 0) return [];
      const rows = await db.member.findMany({
        where: { id: { in: targetIds }, status: 'ACTIVE' },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }
    case 'PROGRAMS': {
      if (targetIds.length === 0) return [];
      const courses = await db.course.findMany({
        where: { programId: { in: targetIds } },
        select: { id: true },
      });
      const courseIds = courses.map((c) => c.id);
      if (courseIds.length === 0) return [];
      const enrollments = await db.enrollment.findMany({
        where: { courseId: { in: courseIds }, status: 'ACTIVE' },
        select: { memberId: true },
      });
      return [...new Set(enrollments.map((e) => e.memberId))];
    }
    case 'ROLES': {
      if (targetIds.length === 0) return [];
      const memberships = await db.membership.findMany({
        where: {
          role: { in: targetIds as ('SHEIKH' | 'ORG_ADMIN' | 'MEMBER' | 'GUARDIAN')[] },
          status: 'ACTIVE',
          memberId: { not: null },
        },
        select: { memberId: true },
      });
      return [
        ...new Set(
          memberships.map((m) => m.memberId).filter((id): id is string => id !== null),
        ),
      ];
    }
    default:
      return [];
  }
}
