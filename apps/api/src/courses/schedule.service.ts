import { Injectable } from '@nestjs/common';
import type { CoursePause, CourseSchedule } from '@prisma/client';
import type {
  CreatePauseInput,
  ListSessionsQuery,
  PauseResponse,
  ScheduleRule,
  ScheduleRuleResponse,
  SessionResponse,
  TimePoint,
} from '@ribat/shared';
import type { AuditContext } from '../audit/audit-context';
import { AuditService } from '../audit/audit.service';
import { badRequest, notFound } from '../common/errors';
import {
  addDays,
  dateIn,
  fromDateString,
  toDateString,
} from '../common/zoned-time';
import { SessionsQueue } from '../jobs/sessions-queue';
import { PrismaService } from '../prisma/prisma.service';
import { CourseAccessService } from './course-access.service';
import { HORIZON_DAYS } from './session-generator.service';

const MAX_SESSION_RANGE_DAYS = 92;

function point(anchor: 'start' | 'end', row: CourseSchedule): TimePoint {
  const a =
    anchor === 'start'
      ? {
          anchor: row.startAnchor,
          time: row.startTime,
          prayer: row.startPrayer,
          offsetMin: row.startOffsetMin,
        }
      : {
          anchor: row.endAnchor,
          time: row.endTime,
          prayer: row.endPrayer,
          offsetMin: row.endOffsetMin,
        };
  return a.anchor === 'FIXED'
    ? { anchor: 'FIXED', time: a.time ?? '00:00' }
    : { anchor: 'PRAYER', prayer: a.prayer ?? 'FAJR', offsetMin: a.offsetMin };
}

function toRuleResponse(row: CourseSchedule): ScheduleRuleResponse {
  return {
    id: row.id,
    weekday: row.weekday,
    start: point('start', row),
    end: point('end', row),
    effectiveFrom: toDateString(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? toDateString(row.effectiveTo) : null,
  };
}

function startColumns(p: TimePoint) {
  return p.anchor === 'FIXED'
    ? {
        startAnchor: 'FIXED' as const,
        startTime: p.time,
        startPrayer: null,
        startOffsetMin: 0,
      }
    : {
        startAnchor: 'PRAYER' as const,
        startTime: null,
        startPrayer: p.prayer,
        startOffsetMin: p.offsetMin,
      };
}

function endColumns(p: TimePoint) {
  return p.anchor === 'FIXED'
    ? {
        endAnchor: 'FIXED' as const,
        endTime: p.time,
        endPrayer: null,
        endOffsetMin: 0,
      }
    : {
        endAnchor: 'PRAYER' as const,
        endTime: null,
        endPrayer: p.prayer,
        endOffsetMin: p.offsetMin,
      };
}

function toPauseResponse(row: CoursePause): PauseResponse {
  return {
    id: row.id,
    courseId: row.courseId,
    fromDate: toDateString(row.fromDate),
    toDate: toDateString(row.toDate),
    reason: row.reason,
  };
}

@Injectable()
export class ScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: CourseAccessService,
    private readonly sessions: SessionsQueue,
  ) {}

  private async today(organizationId: string): Promise<string> {
    const org = await this.prisma.platform.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    return dateIn(new Date(), org.timezone);
  }

  // -------------------------------------------------------------------------
  // Weekly schedule (T207, T208)
  // -------------------------------------------------------------------------

  async getSchedule(
    organizationId: string,
    courseId: string,
  ): Promise<ScheduleRuleResponse[]> {
    await this.access.find(organizationId, courseId);
    const rows = await this.prisma
      .forOrganization(organizationId)
      .courseSchedule.findMany({
        where: { courseId, effectiveTo: null },
        orderBy: [{ weekday: 'asc' }],
      });
    return rows.map(toRuleResponse);
  }

  /**
   * Replaces the active rules from today on. Old rows are closed (effectiveTo), never
   * deleted, so past sessions keep pointing at the rule that produced them.
   */
  async putSchedule(
    organizationId: string,
    courseId: string,
    rules: ScheduleRule[],
    auditCtx: AuditContext,
  ): Promise<ScheduleRuleResponse[]> {
    await this.access.writable(organizationId, courseId);
    rules.forEach((rule, index) => {
      if (
        rule.start.anchor === 'FIXED' &&
        rule.end.anchor === 'FIXED' &&
        rule.end.time <= rule.start.time
      ) {
        throw badRequest(
          `rules.${index}.end`,
          'The class must end after it starts',
        );
      }
    });

    const today = await this.today(organizationId);
    const db = this.prisma.forOrganization(organizationId);
    const before = await this.getSchedule(organizationId, courseId);
    await db.$transaction(async (tx) => {
      // Rules that already ran end yesterday; rules that never ran are closed before they start.
      await tx.courseSchedule.updateMany({
        where: {
          courseId,
          effectiveTo: null,
          effectiveFrom: { lt: fromDateString(today) },
        },
        data: { effectiveTo: fromDateString(addDays(today, -1)) },
      });
      const unused = await tx.courseSchedule.findMany({
        where: { courseId, effectiveTo: null },
      });
      for (const row of unused) {
        await tx.courseSchedule.updateMany({
          where: { id: row.id },
          data: {
            effectiveTo: fromDateString(
              addDays(toDateString(row.effectiveFrom), -1),
            ),
          },
        });
      }
      if (rules.length) {
        await tx.courseSchedule.createMany({
          data: rules.map((rule) => ({
            organizationId,
            courseId,
            weekday: rule.weekday,
            ...startColumns(rule.start),
            ...endColumns(rule.end),
            effectiveFrom: fromDateString(today),
          })),
        });
      }
    });

    const after = await this.getSchedule(organizationId, courseId);
    await this.audit.record(auditCtx, {
      action: 'schedule.replaced',
      entityType: 'course',
      entityId: courseId,
      before,
      after,
    });
    await this.sessions.generateCourse(organizationId, courseId);
    return after;
  }

  // -------------------------------------------------------------------------
  // Pauses (T209)
  // -------------------------------------------------------------------------

  async listPauses(
    organizationId: string,
    courseId: string,
  ): Promise<PauseResponse[]> {
    await this.access.find(organizationId, courseId);
    const rows = await this.prisma
      .forOrganization(organizationId)
      .coursePause.findMany({
        where: { courseId },
        orderBy: { fromDate: 'asc' },
      });
    return rows.map(toPauseResponse);
  }

  async addPause(
    organizationId: string,
    courseId: string,
    input: CreatePauseInput,
    auditCtx: AuditContext,
  ): Promise<PauseResponse> {
    await this.access.writable(organizationId, courseId);
    const row = await this.prisma
      .forOrganization(organizationId)
      .coursePause.create({
        data: {
          organizationId,
          courseId,
          fromDate: fromDateString(input.fromDate),
          toDate: fromDateString(input.toDate),
          reason: input.reason,
        },
      });
    await this.audit.record(auditCtx, {
      action: 'pause.created',
      entityType: 'course',
      entityId: courseId,
      after: toPauseResponse(row),
    });
    await this.sessions.generateCourse(organizationId, courseId);
    return toPauseResponse(row);
  }

  async removePause(
    organizationId: string,
    courseId: string,
    pauseId: string,
    auditCtx: AuditContext,
  ): Promise<void> {
    await this.access.writable(organizationId, courseId);
    const db = this.prisma.forOrganization(organizationId);
    const row = await db.coursePause.findFirst({
      where: { id: pauseId, courseId },
    });
    if (!row) throw notFound('Pause');
    await db.coursePause.deleteMany({ where: { id: pauseId } });
    await this.audit.record(auditCtx, {
      action: 'pause.deleted',
      entityType: 'course',
      entityId: courseId,
      before: toPauseResponse(row),
    });
    await this.sessions.generateCourse(organizationId, courseId);
  }

  // -------------------------------------------------------------------------
  // Sessions (read-only in S2)
  // -------------------------------------------------------------------------

  async listSessions(
    organizationId: string,
    courseId: string,
    query: ListSessionsQuery,
  ): Promise<SessionResponse[]> {
    await this.access.find(organizationId, courseId);
    const today = await this.today(organizationId);
    const from = query.from ?? today;
    const to = query.to ?? addDays(from, HORIZON_DAYS - 1);
    if (to > addDays(from, MAX_SESSION_RANGE_DAYS)) {
      throw badRequest(
        'to',
        `Ask for at most ${MAX_SESSION_RANGE_DAYS} days at a time`,
      );
    }
    const rows = await this.prisma
      .forOrganization(organizationId)
      .courseSession.findMany({
        where: {
          courseId,
          date: { gte: fromDateString(from), lte: fromDateString(to) },
        },
        orderBy: { startsAt: 'asc' },
      });
    return rows.map((row) => ({
      id: row.id,
      courseId: row.courseId,
      date: toDateString(row.date),
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      status: row.status,
      topic: row.topic,
    }));
  }
}
