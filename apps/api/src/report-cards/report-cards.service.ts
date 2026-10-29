import { Injectable } from '@nestjs/common';
import type {
  CreateReportCardInput,
  ListReportCardsQuery,
  ReportCardContent,
  ReportCardResponse,
  UpdateReportCardCommentInput,
} from '@ribat/shared';
import { ReportCardContentSchema } from '@ribat/shared';
import type { OrgContext } from '../auth/org-context.guard';
import type { AuditContext } from '../audit/audit-context';
import { conflict, forbidden, notFound } from '../common/errors';
import { fromDateString, toDateString } from '../common/zoned-time';
import { memberName } from '../courses/course.mapper';
import { CourseAccessService } from '../courses/course-access.service';
import { attendanceCounts } from '../families/portal.service';
import { MemberAccessService } from '../families/member-access.service';
import { emit } from '../events/emit';
import { isStaffContext } from '../progress/class-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ReportCardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MemberAccessService,
    private readonly courses: CourseAccessService,
    private readonly audit: AuditService,
  ) {}

  async list(org: OrgContext, query: ListReportCardsQuery): Promise<ReportCardResponse[]> {
    const db = this.prisma.forOrganization(org.organizationId);
    const where: {
      status?: 'DRAFT' | 'PUBLISHED';
      memberId?: string;
    } = {};
    if (query.status) where.status = query.status;
    if (query.memberId) {
      if (!isStaffContext(org)) await this.access.relation(org, query.memberId);
      where.memberId = query.memberId;
    }

    if (!isStaffContext(org)) {
      if (!org.memberId) throw forbidden();
      const teaches = await db.teachingAssignment.findMany({
        where: { teacherMemberId: org.memberId, endedAt: null },
        select: { courseId: true },
      });
      const courseIds = teaches.map((t) => t.courseId);
      const enrollments = courseIds.length
        ? await db.enrollment.findMany({
            where: { courseId: { in: courseIds }, status: 'ACTIVE' },
            select: { memberId: true },
          })
        : [];
      const memberIds = [...new Set(enrollments.map((e) => e.memberId))];
      const cards = await db.reportCard.findMany({
        where: { ...where, status: 'DRAFT', memberId: { in: memberIds } },
        orderBy: { createdAt: 'desc' },
        include: { member: true, course: { select: { name: true } } },
      });
      return cards.map((c) => this.toResponse(c));
    }

    const cards = await db.reportCard.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { member: true, course: { select: { name: true } } },
    });
    return cards.map((c) => this.toResponse(c));
  }

  async create(
    org: OrgContext,
    input: CreateReportCardInput,
    audit: AuditContext,
  ): Promise<ReportCardResponse> {
    if (!org.permissions.includes('members.manage') && !org.permissions.includes('courses.manage')) {
      throw forbidden();
    }
    const db = this.prisma.forOrganization(org.organizationId);
    const member = await db.member.findFirst({ where: { id: input.memberId } });
    if (!member) throw notFound('Member');
    if (input.courseId) await this.courses.find(org.organizationId, input.courseId);

    const content = await this.buildContent(
      org.organizationId,
      input.memberId,
      input.courseId ?? null,
      input.periodStart,
      input.periodEnd,
    );

    const card = await db.$transaction(async (tx) => {
      const row = await tx.reportCard.create({
        data: {
          organizationId: org.organizationId,
          memberId: input.memberId,
          courseId: input.courseId ?? null,
          periodStart: fromDateString(input.periodStart),
          periodEnd: fromDateString(input.periodEnd),
          content,
          status: 'DRAFT',
          createdByMembershipId: org.membershipId,
        },
        include: { member: true, course: { select: { name: true } } },
      });
      await this.audit.record(
        audit,
        {
          action: 'report_card.create',
          entityType: 'report_card',
          entityId: row.id,
          after: { memberId: row.memberId, status: row.status },
        },
        tx,
      );
      return row;
    });

    return this.toResponse(card);
  }

  async get(org: OrgContext, id: string): Promise<ReportCardResponse> {
    const db = this.prisma.forOrganization(org.organizationId);
    const card = await db.reportCard.findFirst({
      where: { id },
      include: { member: true, course: { select: { name: true } } },
    });
    if (!card) throw notFound('Report card');
    await this.assertCanRead(org, card.memberId, card.courseId, card.status);
    return this.toResponse(card);
  }

  async updateComment(
    org: OrgContext,
    id: string,
    input: UpdateReportCardCommentInput,
    audit: AuditContext,
  ): Promise<ReportCardResponse> {
    const db = this.prisma.forOrganization(org.organizationId);
    const card = await db.reportCard.findFirst({
      where: { id },
      include: { member: true, course: { select: { name: true } } },
    });
    if (!card) throw notFound('Report card');
    if (card.status !== 'DRAFT') throw conflict('Published report cards cannot be edited');
    await this.assertCanComment(org, card.memberId, card.courseId);

    const updated = await db.$transaction(async (tx) => {
      const row = await tx.reportCard.update({
        where: { id },
        data: { teacherComment: input.teacherComment },
        include: { member: true, course: { select: { name: true } } },
      });
      await this.audit.record(
        audit,
        {
          action: 'report_card.comment',
          entityType: 'report_card',
          entityId: row.id,
          after: { hasComment: Boolean(input.teacherComment) },
        },
        tx,
      );
      return row;
    });
    return this.toResponse(updated);
  }

  async publish(org: OrgContext, id: string, audit: AuditContext): Promise<ReportCardResponse> {
    if (!isStaffContext(org)) throw forbidden();
    const db = this.prisma.forOrganization(org.organizationId);
    const card = await db.reportCard.findFirst({
      where: { id },
      include: { member: true, course: { select: { name: true } } },
    });
    if (!card) throw notFound('Report card');
    if (card.status === 'PUBLISHED') throw conflict('Already published');

    const published = await db.$transaction(async (tx) => {
      const row = await tx.reportCard.update({
        where: { id },
        data: { status: 'PUBLISHED', publishedAt: new Date() },
        include: { member: true, course: { select: { name: true } } },
      });
      await emit(tx, audit, {
        type: 'report.published',
        aggregateType: 'report_card',
        aggregateId: row.id,
        payload: {
          reportId: row.id,
          memberId: row.memberId,
          courseId: row.courseId ?? '',
        },
      });
      await this.audit.record(
        audit,
        {
          action: 'report_card.publish',
          entityType: 'report_card',
          entityId: row.id,
          after: { status: 'PUBLISHED' },
        },
        tx,
      );
      return row;
    });

    return this.toResponse(published);
  }

  async listPublishedForMember(org: OrgContext, memberId: string): Promise<ReportCardResponse[]> {
    await this.access.relation(org, memberId);
    const db = this.prisma.forOrganization(org.organizationId);
    const cards = await db.reportCard.findMany({
      where: { memberId, status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      include: { member: true, course: { select: { name: true } } },
    });
    return cards.map((c) => this.toResponse(c));
  }

  private async buildContent(
    organizationId: string,
    memberId: string,
    courseId: string | null,
    periodStart: string,
    periodEnd: string,
  ): Promise<ReportCardContent> {
    const db = this.prisma.forOrganization(organizationId);
    const enrollments = await db.enrollment.findMany({
      where: {
        memberId,
        ...(courseId ? { courseId } : {}),
      },
      select: { id: true },
    });
    const enrollmentIds = enrollments.map((e) => e.id);
    const start = fromDateString(periodStart);
    const end = fromDateString(periodEnd);

    const [marks, logs, tests, tasks] = await Promise.all([
      db.attendance.findMany({
        where: {
          enrollmentId: { in: enrollmentIds },
          session: { date: { gte: start, lte: end } },
        },
        select: { status: true },
      }),
      db.memorizationLog.findMany({
        where: {
          memberId,
          voidedAt: null,
          loggedAt: { gte: start, lte: end },
          ...(courseId ? { courseId } : {}),
        },
        select: { pageFrom: true, pageTo: true },
      }),
      db.memorizationTest.findMany({
        where: {
          memberId,
          takenAt: { gte: start, lte: end },
          ...(courseId ? { courseId } : {}),
        },
        select: { id: true, materialId: true, score: true, passed: true, takenAt: true },
      }),
      db.homeworkTask.findMany({
        where: {
          enrollmentId: { in: enrollmentIds },
          homework: { dueDate: { gte: start, lte: end } },
        },
        select: { status: true },
      }),
    ]);

    const attendance = attendanceCounts(marks.map((m) => m.status));
    let pagesMemorized = 0;
    for (const log of logs) pagesMemorized += log.pageTo - log.pageFrom + 1;

    const content: ReportCardContent = {
      attendanceRate: attendance.rate,
      attendancePresent: attendance.PRESENT,
      attendanceLate: attendance.LATE,
      attendanceAbsent: attendance.ABSENT,
      pagesMemorized,
      tests: tests.map((t) => ({
        testId: t.id,
        materialId: t.materialId,
        score: t.score,
        passed: t.passed,
        takenAt: t.takenAt.toISOString(),
      })),
      homeworkAssigned: tasks.length,
      homeworkDone: tasks.filter((t) => t.status === 'DONE').length,
    };
    return ReportCardContentSchema.parse(content);
  }

  private async assertCanRead(
    org: OrgContext,
    memberId: string,
    courseId: string | null,
    status: 'DRAFT' | 'PUBLISHED',
  ): Promise<void> {
    if (isStaffContext(org)) return;
    if (status === 'PUBLISHED') {
      await this.access.relation(org, memberId);
      return;
    }
    await this.assertCanComment(org, memberId, courseId);
  }

  private async assertCanComment(
    org: OrgContext,
    memberId: string,
    courseId: string | null,
  ): Promise<void> {
    if (isStaffContext(org)) return;
    if (!org.memberId || !courseId) throw forbidden();
    const assignment = await this.courses.activeAssignment(
      org.organizationId,
      courseId,
      org.memberId,
    );
    if (!assignment) throw forbidden();
    const db = this.prisma.forOrganization(org.organizationId);
    const enrolled = await db.enrollment.findFirst({
      where: { memberId, courseId, status: 'ACTIVE' },
    });
    if (!enrolled) throw forbidden();
  }

  private toResponse(card: {
    id: string;
    memberId: string;
    member: { firstName: string; fatherName: string; familyName: string };
    courseId: string | null;
    course: { name: string } | null;
    periodStart: Date;
    periodEnd: Date;
    content: unknown;
    teacherComment: string | null;
    status: 'DRAFT' | 'PUBLISHED';
    publishedAt: Date | null;
    createdAt: Date;
  }): ReportCardResponse {
    return {
      id: card.id,
      memberId: card.memberId,
      memberName: memberName(card.member),
      courseId: card.courseId,
      courseName: card.course?.name ?? null,
      periodStart: toDateString(card.periodStart),
      periodEnd: toDateString(card.periodEnd),
      content: ReportCardContentSchema.parse(card.content),
      teacherComment: card.teacherComment,
      status: card.status,
      publishedAt: card.publishedAt?.toISOString() ?? null,
      createdAt: card.createdAt.toISOString(),
    };
  }
}
