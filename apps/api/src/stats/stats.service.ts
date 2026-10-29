import { Injectable } from '@nestjs/common';
import type {
  StatsCourseMetrics,
  StatsCourseResponse,
  StatsDashboardQuery,
  StatsDashboardResponse,
  StatsMemberMetrics,
  StatsMemberResponse,
  StatsOrgMetrics,
  StatsTeacherMetrics,
  StatsTeacherResponse,
} from '@ribat/shared';
import {
  attendanceRateFromCounters,
  StatsCourseMetricsSchema,
  StatsMemberMetricsSchema,
  StatsOrgMetricsSchema,
  StatsTeacherMetricsSchema,
} from '@ribat/shared';
import type { OrgContext } from '../auth/org-context.guard';
import { forbidden, notFound } from '../common/errors';
import { addDays, dateIn, fromDateString, toDateString } from '../common/zoned-time';
import { memberName } from '../courses/course.mapper';
import { CourseAccessService } from '../courses/course-access.service';
import { MemberAccessService } from '../families/member-access.service';
import { isStaffContext } from '../progress/class-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  mergeCourseMetrics,
  mergeMemberMetrics,
  mergeOrgMetrics,
  mergeTeacherMetrics,
} from './stats-metrics';

const FALLING_BEHIND_RATE = 0.5;
const FALLING_BEHIND_MIN_MARKS = 3;
const TOP_MEMBERS_LIMIT = 5;

@Injectable()
export class StatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly courses: CourseAccessService,
    private readonly memberAccess: MemberAccessService,
  ) {}

  private async orgTimezone(organizationId: string): Promise<string> {
    const org = await this.prisma.platform.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { timezone: true },
    });
    return org.timezone;
  }

  private dateRange(to: string, days: number): { from: string; to: string; dates: string[] } {
    const from = addDays(to, -(days - 1));
    const dates: string[] = [];
    for (let i = 0; i < days; i++) dates.push(addDays(from, i));
    return { from, to, dates };
  }

  private parseOrgMetrics(raw: unknown): StatsOrgMetrics {
    return StatsOrgMetricsSchema.parse(raw);
  }

  private parseCourseMetrics(raw: unknown): StatsCourseMetrics {
    return StatsCourseMetricsSchema.parse(raw);
  }

  private parseTeacherMetrics(raw: unknown): StatsTeacherMetrics {
    return StatsTeacherMetricsSchema.parse(raw);
  }

  private parseMemberMetrics(raw: unknown): StatsMemberMetrics {
    return StatsMemberMetricsSchema.parse(raw);
  }

  async dashboard(org: OrgContext, query: StatsDashboardQuery): Promise<StatsDashboardResponse> {
    if (!org.permissions.includes('courses.manage')) throw forbidden();
    const tz = await this.orgTimezone(org.organizationId);
    const asOf = addDays(dateIn(new Date(), tz), -1);
    const { from, to, dates } = this.dateRange(asOf, query.days);
    const db = this.prisma.forOrganization(org.organizationId);

    const rows = await db.statsDaily.findMany({
      where: {
        date: { gte: fromDateString(from), lte: fromDateString(to) },
      },
    });

    let mosque = this.parseOrgMetrics({
      activeMembers: 0,
      activeCourses: 0,
      activeTeachers: 0,
      pendingJoinApplications: 0,
      attendancePresent: 0,
      attendanceLate: 0,
      attendanceAbsent: 0,
      pagesMemorized: 0,
      testsPassed: 0,
      testsTaken: 0,
    });

    const courseTotals = new Map<string, StatsCourseMetrics>();
    const teacherTotals = new Map<string, StatsTeacherMetrics>();
    const memberTotals = new Map<string, StatsMemberMetrics>();

    for (const row of rows) {
      if (row.scopeType === 'ORG' && row.scopeId === org.organizationId) {
        mosque = mergeOrgMetrics(mosque, this.parseOrgMetrics(row.metrics));
      }
      if (row.scopeType === 'COURSE') {
        const prev = courseTotals.get(row.scopeId) ?? this.emptyCourseMetrics();
        courseTotals.set(row.scopeId, mergeCourseMetrics(prev, this.parseCourseMetrics(row.metrics)));
      }
      if (row.scopeType === 'TEACHER') {
        const prev = teacherTotals.get(row.scopeId) ?? this.emptyTeacherMetrics();
        teacherTotals.set(row.scopeId, mergeTeacherMetrics(prev, this.parseTeacherMetrics(row.metrics)));
      }
      if (row.scopeType === 'MEMBER') {
        const prev = memberTotals.get(row.scopeId) ?? this.emptyMemberMetrics();
        memberTotals.set(row.scopeId, mergeMemberMetrics(prev, this.parseMemberMetrics(row.metrics)));
      }
    }

    const latestOrg = rows
      .filter((r) => r.scopeType === 'ORG' && r.scopeId === org.organizationId)
      .sort((a, b) => b.date.getTime() - a.date.getTime())[0];
    if (latestOrg) {
      const snap = this.parseOrgMetrics(latestOrg.metrics);
      mosque = {
        ...mosque,
        activeMembers: snap.activeMembers,
        activeCourses: snap.activeCourses,
        activeTeachers: snap.activeTeachers,
        pendingJoinApplications: snap.pendingJoinApplications,
      };
    }

    const courseIds = [...courseTotals.keys()];
    const courseMeta = courseIds.length
      ? await db.course.findMany({
          where: { id: { in: courseIds } },
          include: { program: { select: { id: true, name: true } } },
        })
      : [];

    const teacherIds = [...teacherTotals.keys()];
    const teacherMembers = teacherIds.length
      ? await db.member.findMany({ where: { id: { in: teacherIds } } })
      : [];

    const memberIds = [...memberTotals.keys()];
    const memberRows = memberIds.length
      ? await db.member.findMany({ where: { id: { in: memberIds } } })
      : [];

    const courses = courseMeta.map((c) => {
      const totals = courseTotals.get(c.id)!;
      return {
        courseId: c.id,
        courseName: c.name,
        programId: c.programId,
        programName: c.program?.name ?? null,
        attendanceRate: attendanceRateFromCounters(totals),
        pagesMemorized: totals.pagesMemorized,
        testsPassed: totals.testsPassed,
        sessionsMissingAttendance: totals.sessionsMissingAttendance,
      };
    });

    const teachers = teacherMembers.map((t) => {
      const totals = teacherTotals.get(t.id)!;
      const loggedThisWeek = rows.some(
        (r) =>
          r.scopeType === 'TEACHER' &&
          r.scopeId === t.id &&
          this.parseTeacherMetrics(r.metrics).logged,
      );
      return {
        teacherMemberId: t.id,
        teacherName: memberName(t),
        attendanceRate: attendanceRateFromCounters(totals),
        pagesMemorized: totals.pagesMemorized,
        loggedThisWeek,
      };
    });

    const topMembers = memberRows
      .map((m) => ({
        memberId: m.id,
        memberName: memberName(m),
        pagesMemorized: memberTotals.get(m.id)?.pagesMemorized ?? 0,
      }))
      .filter((m) => m.pagesMemorized > 0)
      .sort((a, b) => b.pagesMemorized - a.pagesMemorized)
      .slice(0, TOP_MEMBERS_LIMIT);

    const fallingBehind = memberRows
      .map((m) => {
        const totals = memberTotals.get(m.id)!;
        const countable =
          totals.attendancePresent + totals.attendanceLate + totals.attendanceAbsent;
        const rate = attendanceRateFromCounters(totals);
        return { m, countable, rate };
      })
      .filter(
        (x) =>
          x.countable >= FALLING_BEHIND_MIN_MARKS &&
          x.rate !== null &&
          x.rate < FALLING_BEHIND_RATE,
      )
      .map(({ m, countable, rate }) => ({
        memberId: m.id,
        memberName: memberName(m),
        attendanceRate: rate!,
        countableMarks: countable,
      }));

    return {
      from,
      to,
      asOf,
      mosque,
      courses,
      teachers,
      topMembers,
      fallingBehind,
    };
  }

  async courseStats(org: OrgContext, courseId: string): Promise<StatsCourseResponse> {
    await this.courses.forStaffOrTeacher(org, courseId);
    const tz = await this.orgTimezone(org.organizationId);
    const asOf = addDays(dateIn(new Date(), tz), -1);
    const days = 7;
    const { from, to, dates } = this.dateRange(asOf, days);
    const db = this.prisma.forOrganization(org.organizationId);
    const course = await db.course.findFirstOrThrow({
      where: { id: courseId },
      include: { program: { select: { id: true, name: true } } },
    });

    const rows = await db.statsDaily.findMany({
      where: {
        scopeType: 'COURSE',
        scopeId: courseId,
        date: { gte: fromDateString(from), lte: fromDateString(to) },
      },
    });
    const byDate = new Map(rows.map((r) => [toDateString(r.date), r]));

    let totals = this.emptyCourseMetrics();
    const series = dates.map((date) => {
      const row = byDate.get(date);
      const metrics = row ? this.parseCourseMetrics(row.metrics) : this.emptyCourseMetrics();
      totals = mergeCourseMetrics(totals, metrics);
      return {
        date,
        attendanceRate: attendanceRateFromCounters(metrics),
        pagesMemorized: metrics.pagesMemorized,
        testsPassed: metrics.testsPassed,
        testsTaken: metrics.testsTaken,
      };
    });

    return {
      courseId,
      courseName: course.name,
      programId: course.programId,
      programName: course.program?.name ?? null,
      from,
      to,
      asOf,
      series,
      totals,
    };
  }

  async teacherStats(org: OrgContext, teacherMemberId: string): Promise<StatsTeacherResponse> {
    if (!isStaffContext(org) && org.memberId !== teacherMemberId) throw forbidden();
    const db = this.prisma.forOrganization(org.organizationId);
    const teacher = await db.member.findFirst({ where: { id: teacherMemberId } });
    if (!teacher) throw notFound('Member');

    const assignments = await db.teachingAssignment.findMany({
      where: { teacherMemberId, endedAt: null },
      include: { course: { select: { id: true, name: true } } },
    });
    if (assignments.length === 0 && !isStaffContext(org)) throw forbidden();

    const tz = await this.orgTimezone(org.organizationId);
    const asOf = addDays(dateIn(new Date(), tz), -1);
    const days = 7;
    const { from, to } = this.dateRange(asOf, days);

    const rows = await db.statsDaily.findMany({
      where: {
        scopeType: 'TEACHER',
        scopeId: teacherMemberId,
        date: { gte: fromDateString(from), lte: fromDateString(to) },
      },
    });

    let totals = this.emptyTeacherMetrics();
    let loggedDays = 0;
    for (const row of rows) {
      const metrics = this.parseTeacherMetrics(row.metrics);
      totals = mergeTeacherMetrics(totals, metrics);
      if (metrics.logged) loggedDays += 1;
    }

    const courseSummaries = await Promise.all(
      assignments.map(async (a) => {
        const courseRows = await db.statsDaily.findMany({
          where: {
            scopeType: 'COURSE',
            scopeId: a.courseId,
            date: { gte: fromDateString(from), lte: fromDateString(to) },
          },
        });
        let cm = this.emptyCourseMetrics();
        for (const row of courseRows) cm = mergeCourseMetrics(cm, this.parseCourseMetrics(row.metrics));
        return {
          courseId: a.courseId,
          courseName: a.course.name,
          attendanceRate: attendanceRateFromCounters(cm),
          pagesMemorized: cm.pagesMemorized,
          testsPassed: cm.testsPassed,
        };
      }),
    );

    return {
      teacherMemberId,
      teacherName: memberName(teacher),
      from,
      to,
      asOf,
      loggedDays,
      courses: courseSummaries,
      totals,
    };
  }

  async memberStats(org: OrgContext, memberId: string): Promise<StatsMemberResponse> {
    const { member } = await this.memberAccess.relation(org, memberId);
    const tz = await this.orgTimezone(org.organizationId);
    const asOf = addDays(dateIn(new Date(), tz), -1);
    const days = 7;
    const { from, to, dates } = this.dateRange(asOf, days);
    const db = this.prisma.forOrganization(org.organizationId);

    const rows = await db.statsDaily.findMany({
      where: {
        scopeType: 'MEMBER',
        scopeId: memberId,
        date: { gte: fromDateString(from), lte: fromDateString(to) },
      },
    });
    const byDate = new Map(rows.map((r) => [toDateString(r.date), r]));
    let totals = this.emptyMemberMetrics();
    const series = dates.map((date) => {
      const row = byDate.get(date);
      const metrics = row ? this.parseMemberMetrics(row.metrics) : this.emptyMemberMetrics();
      totals = mergeMemberMetrics(totals, metrics);
      return {
        date,
        attendanceRate: attendanceRateFromCounters(metrics),
        pagesMemorized: metrics.pagesMemorized,
        testsPassed: metrics.testsPassed,
        testsTaken: metrics.testsTaken,
      };
    });

    return {
      memberId,
      memberName: memberName(member),
      from,
      to,
      asOf,
      series,
      totals,
    };
  }

  private emptyCourseMetrics(): StatsCourseMetrics {
    return {
      attendancePresent: 0,
      attendanceLate: 0,
      attendanceAbsent: 0,
      pagesMemorized: 0,
      testsPassed: 0,
      testsTaken: 0,
      sessionsHeld: 0,
      sessionsMissingAttendance: 0,
    };
  }

  private emptyTeacherMetrics(): StatsTeacherMetrics {
    return {
      attendancePresent: 0,
      attendanceLate: 0,
      attendanceAbsent: 0,
      pagesMemorized: 0,
      testsPassed: 0,
      testsTaken: 0,
      logged: false,
    };
  }

  private emptyMemberMetrics(): StatsMemberMetrics {
    return {
      attendancePresent: 0,
      attendanceLate: 0,
      attendanceAbsent: 0,
      pagesMemorized: 0,
      testsPassed: 0,
      testsTaken: 0,
    };
  }
}
