import { Injectable } from '@nestjs/common';
import type {
  CreateDoroosInput,
  DoroosListItem,
  ListSessionsQuery,
} from '@ribat/shared';
import type { AuditContext } from '../audit/audit-context';
import type { OrgContext } from '../auth/org-context.guard';
import { forbidden } from '../common/errors';
import {
  dateIn,
  fromDateString,
  toDateString,
  zonedToUtc,
} from '../common/zoned-time';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
@Injectable()
export class DoroosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    org: OrgContext,
    query: ListSessionsQuery,
  ): Promise<DoroosListItem[]> {
    if (!org.permissions.includes('courses.manage')) throw forbidden();
    const db = this.prisma.forOrganization(org.organizationId);
    const orgRow = await this.prisma.platform.organization.findUniqueOrThrow({
      where: { id: org.organizationId },
      select: { timezone: true },
    });
    const from = query.from ?? dateIn(new Date(), orgRow.timezone);
    const to = query.to ?? from;
    const rows = await db.courseSession.findMany({
      where: {
        date: { gte: fromDateString(from), lte: fromDateString(to) },
        course: { kind: 'ONE_OFF' },
      },
      include: { course: true },
      orderBy: { startsAt: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      courseId: r.courseId,
      date: toDateString(r.date),
      startsAt: r.startsAt.toISOString(),
      endsAt: r.endsAt.toISOString(),
      status: r.status,
      topic: r.topic,
      courseName: r.course.name,
      kind: 'ONE_OFF' as const,
    }));
  }

  async create(org: OrgContext, input: CreateDoroosInput, audit: AuditContext) {
    if (!org.permissions.includes('courses.manage')) throw forbidden();
    const db = this.prisma.forOrganization(org.organizationId);
    const orgRow = await this.prisma.platform.organization.findUniqueOrThrow({
      where: { id: org.organizationId },
    });
    const tz = orgRow.timezone;
    const enrollFromCourses =
      input.courseIds.length > 0
        ? await db.enrollment.findMany({
            where: { courseId: { in: input.courseIds }, status: 'ACTIVE' },
            select: { memberId: true },
          })
        : [];
    const memberIds = [
      ...new Set([
        ...input.memberIds,
        ...enrollFromCourses.map((e) => e.memberId),
      ]),
    ];

    const result = await db.$transaction(async (tx) => {
      const course = await tx.course.create({
        data: {
          organizationId: org.organizationId,
          name: input.name,
          type: input.type,
          kind: 'ONE_OFF',
          status: 'ACTIVE',
        },
      });
      for (const memberId of memberIds) {
        await tx.enrollment.create({
          data: {
            organizationId: org.organizationId,
            courseId: course.id,
            memberId,
            startedAt: fromDateString(input.date),
          },
        });
      }
      for (const teacherMemberId of input.teacherMemberIds) {
        await tx.teachingAssignment.create({
          data: {
            organizationId: org.organizationId,
            courseId: course.id,
            teacherMemberId,
            role: 'LEAD',
          },
        });
      }
      const session = await tx.courseSession.create({
        data: {
          organizationId: org.organizationId,
          courseId: course.id,
          date: fromDateString(input.date),
          startsAt: zonedToUtc(input.date, input.startTime, tz),
          endsAt: zonedToUtc(input.date, input.endTime, tz),
          topic: input.topic ?? null,
          isException: true,
        },
      });
      return { course, session };
    });

    await this.audit.record(audit, {
      action: 'doroos.created',
      entityType: 'course',
      entityId: result.course.id,
      after: { sessionId: result.session.id, name: input.name },
    });

    return {
      courseId: result.course.id,
      sessionId: result.session.id,
    };
  }
}
