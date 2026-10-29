import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { StatsScopeType } from '@prisma/client';
import type {
  StatsCourseMetrics,
  StatsMemberMetrics,
  StatsOrgMetrics,
  StatsTeacherMetrics,
} from '@ribat/shared';
import {
  StatsCourseMetricsSchema,
  StatsMemberMetricsSchema,
  StatsOrgMetricsSchema,
  StatsTeacherMetricsSchema,
} from '@ribat/shared';
import { Queue } from 'bullmq';
import type IORedis from 'ioredis';
import { addDays, dateIn, fromDateString, toDateString } from '../common/zoned-time';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { EVENTS_QUEUE } from '../events/events-queue';
import { bullConnection } from '../jobs/sessions-queue';
import { PrismaService } from '../prisma/prisma.service';
import {
  addAttendanceStatus,
  emptyAttendanceCounters,
  emptyProgressCounters,
  mergeCourseMetrics,
  mergeMemberMetrics,
  mergeOrgMetrics,
  mergeTeacherMetrics,
  pagesInRange,
} from './stats-metrics';
import type { OrgTx } from '../prisma/prisma.service';

/** Tenant scope forbids upsert/update on unique keys (organization-scope.ts). */
async function writeStatsDailyRow(
  db: OrgTx,
  organizationId: string,
  date: Date,
  scopeType: StatsScopeType,
  scopeId: string,
  metrics: object,
): Promise<void> {
  const existing = await db.statsDaily.findFirst({
    where: { date, scopeType, scopeId },
    select: { id: true },
  });
  if (existing) {
    await db.statsDaily.updateMany({
      where: { id: existing.id },
      data: { metrics },
    });
  } else {
    await db.statsDaily.create({
      data: { organizationId, date, scopeType, scopeId, metrics },
    });
  }
}

export type StatsOrgJob = { organizationId: string };

@Injectable()
export class StatsRollupService implements OnModuleInit {
  private readonly logger = new Logger(StatsRollupService.name);
  private readonly connection: IORedis;
  readonly queue: Queue;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
  ) {
    this.connection = bullConnection(env);
    this.queue = new Queue(EVENTS_QUEUE, { connection: this.connection });
  }

  async onModuleInit() {
    if (this.env.JOBS_WORKER === 'off') return;
    const orgs = await this.prisma.platform.organization.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, timezone: true },
    });
    for (const org of orgs) {
      await this.scheduleRollup(org);
      await this.catchUp(org.id, org.timezone);
    }
  }

  async scheduleRollup(org: { id: string; timezone: string }): Promise<void> {
    try {
      await this.queue.upsertJobScheduler(
        `stats:${org.id}`,
        { pattern: '0 3 * * *', tz: org.timezone },
        { name: 'stats-org', data: { organizationId: org.id } satisfies StatsOrgJob },
      );
    } catch (error) {
      this.logger.warn(
        `stats scheduler unavailable: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /** Roll up yesterday if the ORG row is missing (deploy catch-up). */
  async catchUp(organizationId: string, timezone: string, now = new Date()): Promise<void> {
    const yesterday = addDays(dateIn(now, timezone), -1);
    const db = this.prisma.forOrganization(organizationId);
    const existing = await db.statsDaily.findFirst({
      where: { date: fromDateString(yesterday), scopeType: 'ORG', scopeId: organizationId },
      select: { id: true },
    });
    if (!existing) await this.rollupDay(organizationId, yesterday);
  }

  async run(organizationId: string, now = new Date()): Promise<{ date: string; scopes: number }> {
    const org = await this.prisma.platform.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { timezone: true },
    });
    const date = addDays(dateIn(now, org.timezone), -1);
    const scopes = await this.rollupDay(organizationId, date);
    return { date, scopes };
  }

  async rollupDay(organizationId: string, date: string): Promise<number> {
    const db = this.prisma.forOrganization(organizationId);
    const dateValue = fromDateString(date);

    const [
      members,
      courses,
      teachers,
      pendingApps,
      sessions,
      attendance,
      logs,
      tests,
      materialLogs,
    ] = await Promise.all([
      db.member.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true },
      }),
      db.course.findMany({
        where: { status: { in: ['ACTIVE', 'PAUSED'] } },
        select: { id: true },
      }),
      db.teachingAssignment.findMany({
        where: { endedAt: null },
        select: { teacherMemberId: true, courseId: true },
      }),
      db.joinApplication.count({ where: { status: 'PENDING' } }),
      db.courseSession.findMany({
        where: { date: dateValue, status: { not: 'CANCELLED' } },
        select: { id: true, courseId: true, endsAt: true, status: true },
      }),
      db.attendance.findMany({
        where: { session: { date: dateValue } },
        select: {
          status: true,
          sessionId: true,
          markedByMemberId: true,
          session: { select: { courseId: true } },
          enrollment: { select: { memberId: true, courseId: true } },
        },
      }),
      db.memorizationLog.findMany({
        where: { voidedAt: null },
        select: {
          pageFrom: true,
          pageTo: true,
          countsProgress: true,
          loggedAt: true,
          loggedByMemberId: true,
          memberId: true,
          courseId: true,
        },
      }),
      db.memorizationTest.findMany({
        select: {
          passed: true,
          takenAt: true,
          memberId: true,
          courseId: true,
        },
      }),
      db.materialLog.findMany({
        where: { session: { date: dateValue } },
        select: { loggedByMemberId: true, session: { select: { courseId: true } } },
      }),
    ]);

    const org = await this.prisma.platform.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { timezone: true },
    });
    const tz = org.timezone;

    const logsToday = logs.filter((l) => dateIn(l.loggedAt, tz) === date);
    const testsToday = tests.filter((t) => dateIn(t.takenAt, tz) === date);

    const sessionsWithAttendance = new Set(attendance.map((a) => a.sessionId));
    const teacherIds = [...new Set(teachers.map((t) => t.teacherMemberId))];
    const enrolledMemberIds = [
      ...new Set(
        (
          await db.enrollment.findMany({
            where: { status: 'ACTIVE' },
            select: { memberId: true },
          })
        ).map((e) => e.memberId),
      ),
    ];

    const courseMetrics = new Map<string, StatsCourseMetrics>();
    const teacherMetrics = new Map<string, StatsTeacherMetrics>();
    const memberMetrics = new Map<string, StatsMemberMetrics>();

    const initCourse = (): StatsCourseMetrics => ({
      ...emptyAttendanceCounters(),
      ...emptyProgressCounters(),
      sessionsHeld: 0,
      sessionsMissingAttendance: 0,
    });
    const initTeacher = (): StatsTeacherMetrics => ({
      ...emptyAttendanceCounters(),
      ...emptyProgressCounters(),
      logged: false,
    });
    const initMember = (): StatsMemberMetrics => ({
      ...emptyAttendanceCounters(),
      ...emptyProgressCounters(),
    });

    for (const course of courses) courseMetrics.set(course.id, initCourse());
    for (const id of teacherIds) teacherMetrics.set(id, initTeacher());
    for (const id of enrolledMemberIds) memberMetrics.set(id, initMember());

    let orgAttendance = emptyAttendanceCounters();
    let orgProgress = emptyProgressCounters();

    for (const session of sessions) {
      const cm = courseMetrics.get(session.courseId) ?? initCourse();
      cm.sessionsHeld += 1;
      if (!sessionsWithAttendance.has(session.id)) cm.sessionsMissingAttendance += 1;
      courseMetrics.set(session.courseId, cm);
    }

    for (const mark of attendance) {
      orgAttendance = addAttendanceStatus(orgAttendance, mark.status);
      const courseId = mark.session.courseId;
      const memberId = mark.enrollment.memberId;
      const cm = courseMetrics.get(courseId) ?? initCourse();
      courseMetrics.set(courseId, {
        ...cm,
        ...addAttendanceStatus(cm, mark.status),
      });
      const mm = memberMetrics.get(memberId) ?? initMember();
      memberMetrics.set(memberId, {
        ...mm,
        ...addAttendanceStatus(mm, mark.status),
      });
      for (const ta of teachers.filter((t) => t.courseId === courseId)) {
        const tm = teacherMetrics.get(ta.teacherMemberId) ?? initTeacher();
        teacherMetrics.set(ta.teacherMemberId, {
          ...tm,
          ...addAttendanceStatus(tm, mark.status),
        });
      }
    }

    const markTeacherLogged = (teacherMemberId: string) => {
      const tm = teacherMetrics.get(teacherMemberId) ?? initTeacher();
      teacherMetrics.set(teacherMemberId, { ...tm, logged: true });
    };

    for (const mark of attendance) markTeacherLogged(mark.markedByMemberId);
    for (const ml of materialLogs) markTeacherLogged(ml.loggedByMemberId);

    for (const log of logsToday) {
      markTeacherLogged(log.loggedByMemberId);
      if (!log.countsProgress) continue;
      const pages = pagesInRange(log.pageFrom, log.pageTo);
      orgProgress = {
        ...orgProgress,
        pagesMemorized: orgProgress.pagesMemorized + pages,
      };

      const mm = memberMetrics.get(log.memberId) ?? initMember();
      memberMetrics.set(log.memberId, {
        ...mm,
        pagesMemorized: mm.pagesMemorized + pages,
      });

      if (log.courseId) {
        const cm = courseMetrics.get(log.courseId) ?? initCourse();
        courseMetrics.set(log.courseId, {
          ...cm,
          pagesMemorized: cm.pagesMemorized + pages,
        });
        for (const ta of teachers.filter((t) => t.courseId === log.courseId)) {
          const tm = teacherMetrics.get(ta.teacherMemberId) ?? initTeacher();
          teacherMetrics.set(ta.teacherMemberId, {
            ...tm,
            pagesMemorized: tm.pagesMemorized + pages,
          });
        }
      }
    }

    for (const test of testsToday) {
      orgProgress = {
        ...orgProgress,
        testsTaken: orgProgress.testsTaken + 1,
        testsPassed: orgProgress.testsPassed + (test.passed ? 1 : 0),
      };
      const mm = memberMetrics.get(test.memberId) ?? initMember();
      memberMetrics.set(test.memberId, {
        ...mm,
        testsTaken: mm.testsTaken + 1,
        testsPassed: mm.testsPassed + (test.passed ? 1 : 0),
      });
      if (test.courseId) {
        const cm = courseMetrics.get(test.courseId) ?? initCourse();
        courseMetrics.set(test.courseId, {
          ...cm,
          testsTaken: cm.testsTaken + 1,
          testsPassed: cm.testsPassed + (test.passed ? 1 : 0),
        });
        for (const ta of teachers.filter((t) => t.courseId === test.courseId)) {
          const tm = teacherMetrics.get(ta.teacherMemberId) ?? initTeacher();
          teacherMetrics.set(ta.teacherMemberId, {
            ...tm,
            testsTaken: tm.testsTaken + 1,
            testsPassed: tm.testsPassed + (test.passed ? 1 : 0),
          });
        }
      }
    }

    const orgMetrics: StatsOrgMetrics = {
      activeMembers: members.length,
      activeCourses: courses.length,
      activeTeachers: teacherIds.length,
      pendingJoinApplications: pendingApps,
      ...orgAttendance,
      ...orgProgress,
    };
    StatsOrgMetricsSchema.parse(orgMetrics);

    const writes: Promise<void>[] = [
      writeStatsDailyRow(db, organizationId, dateValue, 'ORG', organizationId, orgMetrics),
    ];

    for (const [scopeId, metrics] of courseMetrics) {
      StatsCourseMetricsSchema.parse(metrics);
      writes.push(writeStatsDailyRow(db, organizationId, dateValue, 'COURSE', scopeId, metrics));
    }

    for (const [scopeId, metrics] of teacherMetrics) {
      StatsTeacherMetricsSchema.parse(metrics);
      writes.push(writeStatsDailyRow(db, organizationId, dateValue, 'TEACHER', scopeId, metrics));
    }

    for (const [scopeId, metrics] of memberMetrics) {
      StatsMemberMetricsSchema.parse(metrics);
      writes.push(writeStatsDailyRow(db, organizationId, dateValue, 'MEMBER', scopeId, metrics));
    }

    for (const op of writes) await op;
    return writes.length;
  }
}

