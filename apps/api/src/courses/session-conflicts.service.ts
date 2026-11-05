import { Injectable } from '@nestjs/common';
import type {
  PreviewSessionConflictsInput,
  SessionConflict,
} from '@ribat/shared';
import type { OrgContext } from '../auth/org-context.guard';
import { memberName } from './course.mapper';
import { PrismaService } from '../prisma/prisma.service';

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

@Injectable()
export class SessionConflictsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMemberConflicts(
    org: OrgContext,
    input: PreviewSessionConflictsInput,
  ): Promise<SessionConflict[]> {
    const db = this.prisma.forOrganization(org.organizationId);
    const memberIds = [...new Set(input.memberIds)];
    const windows = input.windows.map((w) => ({
      startsAt: new Date(w.startsAt),
      endsAt: new Date(w.endsAt),
    }));

    const enrollments = await db.enrollment.findMany({
      where: { memberId: { in: memberIds }, status: 'ACTIVE' },
      select: { memberId: true, courseId: true, member: true },
    });
    const teaching = await db.teachingAssignment.findMany({
      where: { teacherMemberId: { in: memberIds }, endedAt: null },
      select: { teacherMemberId: true, courseId: true, teacher: true },
    });
    const courseIds = [
      ...new Set([
        ...enrollments.map((e) => e.courseId),
        ...teaching.map((t) => t.courseId),
      ]),
    ].filter((id) => id !== input.excludeCourseId);

    if (courseIds.length === 0) return [];

    const sessions = await db.courseSession.findMany({
      where: {
        courseId: { in: courseIds },
        status: { not: 'CANCELLED' },
      },
      include: { course: { select: { name: true } } },
    });

    const out: SessionConflict[] = [];
    const seen = new Set<string>();
    for (const memberId of memberIds) {
      const memberCourses = new Set([
        ...enrollments
          .filter((e) => e.memberId === memberId)
          .map((e) => e.courseId),
        ...teaching
          .filter((t) => t.teacherMemberId === memberId)
          .map((t) => t.courseId),
      ]);
      const name =
        enrollments.find((e) => e.memberId === memberId)?.member ??
        teaching.find((t) => t.teacherMemberId === memberId)?.teacher;
      const memberLabel = name ? memberName(name) : memberId;
      for (const s of sessions) {
        if (!memberCourses.has(s.courseId)) continue;
        for (const w of windows) {
          if (!overlaps(w.startsAt, w.endsAt, s.startsAt, s.endsAt)) continue;
          const key = `${memberId}:${s.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({
            memberId,
            memberName: memberLabel,
            courseId: s.courseId,
            courseName: s.course.name,
            startsAt: s.startsAt.toISOString(),
            endsAt: s.endsAt.toISOString(),
          });
        }
      }
    }
    return out;
  }
}
