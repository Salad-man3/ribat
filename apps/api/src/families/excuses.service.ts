import { Injectable } from '@nestjs/common';
import type { ExcuseRequest } from '@prisma/client';
import type { CreateExcuseInput, ExcuseResponse, ListExcusesQuery } from '@ribat/shared';
import type { AuditContext } from '../audit/audit-context';
import { AuditService } from '../audit/audit.service';
import type { OrgContext } from '../auth/org-context.guard';
import { conflict, notFound } from '../common/errors';
import { fromDateString, toDateString } from '../common/zoned-time';
import { memberName } from '../courses/course.mapper';
import { emit } from '../events/emit';
import { PrismaService } from '../prisma/prisma.service';
import { isStaffContext } from '../progress/class-scope.service';
import { MemberAccessService } from './member-access.service';


export function toExcuseResponse(row: ExcuseRequest, names: Map<string, string>, courses: Map<string, string>): ExcuseResponse {
  return {
    id: row.id,
    memberId: row.memberId,
    memberName: names.get(row.memberId) ?? '',
    courseId: row.courseId,
    courseName: row.courseId ? (courses.get(row.courseId) ?? null) : null,
    fromDate: toDateString(row.fromDate),
    toDate: toDateString(row.toDate),
    reason: row.reason,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
  };
}

/** T404, WF-08: families submit, staff decide; accepting turns matching marks into EXCUSED (decision 8.3). */
@Injectable()
export class ExcusesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: MemberAccessService,
  ) {}

  async present(organizationId: string, rows: ExcuseRequest[]): Promise<ExcuseResponse[]> {
    const db = this.prisma.forOrganization(organizationId);
    const [members, courses] = await Promise.all([
      db.member.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.memberId))] } } }),
      db.course.findMany({
        where: { id: { in: rows.flatMap((r) => (r.courseId ? [r.courseId] : [])) } },
        select: { id: true, name: true },
      }),
    ]);
    const names = new Map(members.map((m) => [m.id, memberName(m)]));
    const courseNames = new Map(courses.map((c) => [c.id, c.name]));
    return rows.map((r) => toExcuseResponse(r, names, courseNames));
  }

  async create(org: OrgContext, audit: AuditContext, input: CreateExcuseInput): Promise<ExcuseResponse> {
    await this.access.relation(org, input.memberId);
    const db = this.prisma.forOrganization(org.organizationId);
    if (input.courseId && !(await db.course.findFirst({ where: { id: input.courseId } }))) throw notFound('Course');
    const row = await db.excuseRequest.create({
      data: {
        organizationId: org.organizationId,
        memberId: input.memberId,
        courseId: input.courseId,
        fromDate: fromDateString(input.fromDate),
        toDate: fromDateString(input.toDate),
        reason: input.reason,
        submittedByIdentityId: audit.actorIdentityId!,
      },
    });
    await this.audit.record(audit, {
      action: 'excuse.submitted',
      entityType: 'excuse',
      entityId: row.id,
      after: { memberId: row.memberId, courseId: row.courseId, fromDate: input.fromDate, toDate: input.toDate },
    });
    return (await this.present(org.organizationId, [row]))[0];
  }

  /** Staff see every excuse; anyone else sees their own and their wards'. */
  async list(org: OrgContext, audit: AuditContext, query: ListExcusesQuery): Promise<ExcuseResponse[]> {
    const db = this.prisma.forOrganization(org.organizationId);
    const family = await this.access.family(org);
    const mine = [family.self, ...family.wards].filter((id): id is string => !!id);
    const rows = await db.excuseRequest.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(isStaffContext(org)
          ? {}
          : { OR: [{ submittedByIdentityId: audit.actorIdentityId! }, { memberId: { in: mine } }] }),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return this.present(org.organizationId, rows);
  }

  async decide(
    org: OrgContext,
    audit: AuditContext,
    excuseId: string,
    decision: 'ACCEPTED' | 'REJECTED',
  ): Promise<ExcuseResponse> {
    const db = this.prisma.forOrganization(org.organizationId);
    const excuse = await db.excuseRequest.findFirst({ where: { id: excuseId } });
    if (!excuse) throw notFound('Excuse');
    if (excuse.status !== 'PENDING') throw conflict('This excuse was already decided');

    const row = await db.$transaction(async (tx) => {
      const [updated] = await tx.excuseRequest.updateManyAndReturn({
        where: { id: excuseId, status: 'PENDING' },
        data: { status: decision, decidedByMembershipId: org.membershipId, decidedAt: new Date() },
      });
      if (!updated) throw conflict('This excuse was already decided');

      let excused: string[] = [];
      if (decision === 'ACCEPTED') {
        const marks = await tx.attendance.findMany({
          where: {
            status: { in: ['ABSENT', 'LATE'] },
            enrollment: { memberId: excuse.memberId, ...(excuse.courseId ? { courseId: excuse.courseId } : {}) },
            session: { date: { gte: excuse.fromDate, lte: excuse.toDate } },
          },
          select: { id: true },
        });
        excused = marks.map((m) => m.id);
        // Marks taken later are recorded as EXCUSED at write time (ProgressWriterService).
        await tx.attendance.updateMany({ where: { id: { in: excused } }, data: { status: 'EXCUSED' } });
      }
      await this.audit.record(
        audit,
        {
          action: 'excuse.decided',
          entityType: 'excuse',
          entityId: excuseId,
          before: { status: 'PENDING' },
          after: { status: decision, excusedAttendanceIds: excused },
        },
        tx,
      );
      await emit(tx, audit, {
        type: 'excuse.decided',
        aggregateType: 'excuse',
        aggregateId: excuseId,
        payload: { excuseId, memberId: excuse.memberId, decision },
      });
      return updated;
    });
    return (await this.present(org.organizationId, [row]))[0];
  }
}
