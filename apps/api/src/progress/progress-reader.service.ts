import { Injectable } from '@nestjs/common';
import type { Member } from '@prisma/client';
import type {
  ClassKit,
  CreateSessionInput,
  ListProgressQuery,
  ListSessionsQuery,
  MaterialLogResponse,
  MemorizationLogResponse,
  MemorizationTestResponse,
  CourseHalaqaWall,
  SessionAttendanceResponse,
  SessionResponse,
  StaffSessionsResponse,
  StaffTodayOverview,
  UpdateSessionInput,
} from '@ribat/shared';
import { hifzMapFromData } from './hifz-map';
import type { AuditContext } from '../audit/audit-context';
import { AuditService } from '../audit/audit.service';
import type { OrgContext } from '../auth/org-context.guard';
import {
  badRequest,
  conflict,
  forbidden,
  isUniqueViolation,
  notFound,
} from '../common/errors';
import {
  addDays,
  dateIn,
  fromDateString,
  toDateString,
  zonedToUtc,
} from '../common/zoned-time';
import { memberName } from '../courses/course.mapper';
import { emit } from '../events/emit';
import { PrismaService } from '../prisma/prisma.service';
import {
  ClassScopeService,
  isStaffContext,
  type ClassScope,
} from './class-scope.service';
import {
  toAttendanceResponse,
  toLogResponse,
  toMaterialLogResponse,
  toSummaryResponse,
  toTestResponse,
} from './progress.mapper';

function toSession(row: {
  id: string;
  courseId: string;
  date: Date;
  startsAt: Date;
  endsAt: Date;
  status: SessionResponse['status'];
  topic: string | null;
}): SessionResponse {
  return {
    id: row.id,
    courseId: row.courseId,
    date: toDateString(row.date),
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    status: row.status,
    topic: row.topic,
  };
}

const byName = (a: { member: Member }, b: { member: Member }) =>
  memberName(a.member).localeCompare(memberName(b.member));

@Injectable()
export class ProgressReaderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly scope: ClassScopeService,
  ) {}

  private async timezone(organizationId: string): Promise<string> {
    const org = await this.prisma.platform.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { timezone: true },
    });
    return org.timezone;
  }

  private async session(org: OrgContext, sessionId: string) {
    const row = await this.prisma
      .forOrganization(org.organizationId)
      .courseSession.findFirst({ where: { id: sessionId } });
    if (!row) throw notFound('Session');
    return row;
  }

  /** Staff lobby: org-wide sessions in a date range with course and lead teacher. */
  async listStaffSessions(
    org: OrgContext,
    query: ListSessionsQuery,
  ): Promise<StaffSessionsResponse> {
    if (!org.permissions.includes('courses.manage')) throw forbidden();
    const timezone = await this.timezone(org.organizationId);
    const today = dateIn(new Date(), timezone);
    const from = query.from ?? today;
    const to = query.to ?? addDays(from, 6);
    if (to > addDays(from, 92)) {
      throw badRequest('to', 'Ask for at most 92 days at a time');
    }
    const db = this.prisma.forOrganization(org.organizationId);
    const [rows, activeTeachers] = await Promise.all([
      db.courseSession.findMany({
        where: {
          date: { gte: fromDateString(from), lte: fromDateString(to) },
          status: { not: 'CANCELLED' },
        },
        include: { course: true },
        orderBy: [{ date: 'asc' }, { startsAt: 'asc' }],
      }),
      db.teachingAssignment.groupBy({
        by: ['teacherMemberId'],
        where: { endedAt: null },
      }),
    ]);
    const courseIds = [...new Set(rows.map((r) => r.courseId))];
    const assignments = courseIds.length
      ? await db.teachingAssignment.findMany({
          where: { courseId: { in: courseIds }, endedAt: null },
          include: { teacher: true },
          orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        })
      : [];
    const leadByCourse = new Map<string, string>();
    for (const row of assignments) {
      const name = memberName(row.teacher);
      const prev = leadByCourse.get(row.courseId);
      if (!prev || row.role === 'LEAD') leadByCourse.set(row.courseId, name);
    }
    return {
      activeTeacherCount: activeTeachers.length,
      sessions: rows.map((row) => ({
        id: row.id,
        courseId: row.courseId,
        courseName: row.course.name,
        date: toDateString(row.date),
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
        status: row.status,
        topic: row.topic,
        leadTeacherName: leadByCourse.get(row.courseId) ?? null,
      })),
    };
  }

  /** Live same-day attendance and memorization for the staff lobby (SC-DOD-2). */
  async staffTodayOverview(org: OrgContext): Promise<StaffTodayOverview> {
    if (!org.permissions.includes('courses.manage')) throw forbidden();
    const timezone = await this.timezone(org.organizationId);
    const date = dateIn(new Date(), timezone);
    const dayStart = zonedToUtc(date, '00:00', timezone);
    const dayEnd = zonedToUtc(addDays(date, 1), '00:00', timezone);
    const db = this.prisma.forOrganization(org.organizationId);

    const sessions = await db.courseSession.findMany({
      where: {
        date: fromDateString(date),
        status: { not: 'CANCELLED' },
      },
      include: { course: true },
    });
    const sessionIds = sessions.map((s) => s.id);
    const courseNameById = new Map(sessions.map((s) => [s.courseId, s.course.name]));

    const [absenceRows, logRows] = await Promise.all([
      sessionIds.length
        ? db.attendance.findMany({
            where: { sessionId: { in: sessionIds }, status: 'ABSENT' },
            include: {
              enrollment: { include: { member: true } },
              session: { include: { course: true } },
            },
            orderBy: [{ markedAt: 'desc' }],
            take: 30,
          })
        : Promise.resolve([]),
      db.memorizationLog.findMany({
        where: {
          loggedAt: { gte: dayStart, lt: dayEnd },
          voidedAt: null,
          countsProgress: true,
        },
        include: { member: true, course: true },
        orderBy: { loggedAt: 'desc' },
        take: 20,
      }),
    ]);

    return {
      date,
      absenceCount: absenceRows.length,
      absences: absenceRows.map((row) => ({
        memberName: memberName(row.enrollment.member),
        courseName: row.session.course.name,
      })),
      memorizationLogCount: await db.memorizationLog.count({
        where: {
          loggedAt: { gte: dayStart, lt: dayEnd },
          voidedAt: null,
          countsProgress: true,
        },
      }),
      memorizationLogs: logRows.map((row) => ({
        memberName: memberName(row.member),
        courseName: row.course?.name ?? courseNameById.get(row.courseId ?? '') ?? '',
        pageFrom: row.pageFrom,
        pageTo: row.pageTo,
      })),
    };
  }

  // -------------------------------------------------------------------------
  // Sessions
  // -------------------------------------------------------------------------

  /** Roster with current marks; a teacher sees their own group only (PERM-11). */
  async roster(
    org: OrgContext,
    sessionId: string,
  ): Promise<SessionAttendanceResponse> {
    const session = await this.session(org, sessionId);
    const scope = await this.scope.forCourse(org, session.courseId, 'read');
    const db = this.prisma.forOrganization(org.organizationId);
    const [enrollments, marks] = await Promise.all([
      db.enrollment.findMany({
        where: this.scope.enrollmentFilter(scope),
        include: { member: true },
      }),
      db.attendance.findMany({ where: { sessionId } }),
    ]);
    const markOf = new Map(marks.map((m) => [m.enrollmentId, m]));
    return {
      session: toSession(session),
      roster: enrollments.sort(byName).map((e) => {
        const mark = markOf.get(e.id);
        return {
          enrollmentId: e.id,
          memberId: e.memberId,
          name: memberName(e.member),
          attendance: mark ? toAttendanceResponse(mark) : null,
        };
      }),
    };
  }

  /** An extra session added by hand: staff, or a teacher of the course. */
  async addSession(
    org: OrgContext,
    audit: AuditContext,
    courseId: string,
    input: CreateSessionInput,
  ): Promise<SessionResponse> {
    await this.scope.forCourse(org, courseId, 'write');
    const tz = await this.timezone(org.organizationId);
    try {
      const row = await this.prisma
        .forOrganization(org.organizationId)
        .courseSession.create({
          data: {
            organizationId: org.organizationId,
            courseId,
            date: fromDateString(input.date),
            startsAt: zonedToUtc(input.date, input.startTime, tz),
            endsAt: zonedToUtc(input.date, input.endTime, tz),
            topic: input.topic ?? null,
            isException: true,
          },
        });
      await this.audit.record(audit, {
        action: 'session.created',
        entityType: 'course_session',
        entityId: row.id,
        after: toSession(row),
      });
      return toSession(row);
    } catch (error) {
      if (isUniqueViolation(error))
        throw conflict('A session already starts at that time');
      throw error;
    }
  }

  /** Cancel, restore, or change the topic. A session with attendance cannot be cancelled. */
  async updateSession(
    org: OrgContext,
    audit: AuditContext,
    sessionId: string,
    input: UpdateSessionInput,
  ): Promise<SessionResponse> {
    const session = await this.session(org, sessionId);
    await this.scope.forCourse(org, session.courseId, 'write');
    const db = this.prisma.forOrganization(org.organizationId);
    if (
      input.status === 'CANCELLED' &&
      (await db.attendance.count({ where: { sessionId } })) > 0
    )
      throw conflict('This session already has attendance');

    const status =
      input.status === 'SCHEDULED' && session.status === 'CANCELLED'
        ? (await db.attendance.count({ where: { sessionId } })) > 0
          ? 'HELD'
          : 'SCHEDULED'
        : (input.status ?? session.status);
    const row = await db.$transaction(async (tx) => {
      const [updated] = await tx.courseSession.updateManyAndReturn({
        where: { id: sessionId },
        data: {
          status,
          ...(input.topic !== undefined ? { topic: input.topic } : {}),
        },
      });
      if (status === 'CANCELLED' && session.status !== 'CANCELLED')
        await emit(tx, audit, {
          type: 'session.cancelled',
          aggregateType: 'course_session',
          aggregateId: sessionId,
          payload: { sessionId, courseId: session.courseId },
        });
      return updated;
    });
    await this.audit.record(audit, {
      action: status === 'CANCELLED' ? 'session.cancelled' : 'session.updated',
      entityType: 'course_session',
      entityId: sessionId,
      before: toSession(session),
      after: toSession(row),
    });
    return toSession(row);
  }

  // -------------------------------------------------------------------------
  // Progress lists
  // -------------------------------------------------------------------------

  /**
   * Staff read everything; a teacher must name a course and sees only the students
   * they teach there. Member and guardian reads go through /members/:id/progress.
   */
  private async listScope(org: OrgContext, query: ListProgressQuery) {
    if (!query.courseId) {
      if (!isStaffContext(org)) throw badRequest('courseId', 'Choose a course');
      return { courseId: undefined, memberIds: undefined };
    }
    const scope = await this.scope.forCourse(org, query.courseId, 'read');
    if (!scope.groupIds)
      return { courseId: query.courseId, memberIds: undefined };
    return {
      courseId: query.courseId,
      memberIds: await this.memberIdsIn(org, scope),
    };
  }

  private async memberIdsIn(
    org: OrgContext,
    scope: ClassScope,
  ): Promise<string[]> {
    const rows = await this.prisma
      .forOrganization(org.organizationId)
      .enrollment.findMany({
        where: this.scope.enrollmentFilter(scope),
        select: { memberId: true },
      });
    return rows.map((r) => r.memberId);
  }

  private async range(org: OrgContext, query: ListProgressQuery) {
    if (!query.from && !query.to) return undefined;
    const tz = await this.timezone(org.organizationId);
    return {
      ...(query.from ? { gte: zonedToUtc(query.from, '00:00', tz) } : {}),
      ...(query.to
        ? { lt: zonedToUtc(addDays(query.to, 1), '00:00', tz) }
        : {}),
    };
  }

  async listLogs(
    org: OrgContext,
    query: ListProgressQuery,
  ): Promise<MemorizationLogResponse[]> {
    const { courseId, memberIds } = await this.listScope(org, query);
    const loggedAt = await this.range(org, query);
    const rows = await this.prisma
      .forOrganization(org.organizationId)
      .memorizationLog.findMany({
        where: {
          ...(courseId ? { courseId } : {}),
          ...(query.materialId ? { materialId: query.materialId } : {}),
          memberId: memberIds
            ? {
                in: query.memberId
                  ? memberIds.filter((m) => m === query.memberId)
                  : memberIds,
              }
            : query.memberId,
          ...(loggedAt ? { loggedAt } : {}),
        },
        orderBy: { loggedAt: 'desc' },
        take: query.limit,
      });
    return rows.map(toLogResponse);
  }

  async listTests(
    org: OrgContext,
    query: ListProgressQuery,
  ): Promise<MemorizationTestResponse[]> {
    const { courseId, memberIds } = await this.listScope(org, query);
    const takenAt = await this.range(org, query);
    const rows = await this.prisma
      .forOrganization(org.organizationId)
      .memorizationTest.findMany({
        where: {
          ...(courseId ? { courseId } : {}),
          ...(query.materialId ? { materialId: query.materialId } : {}),
          memberId: memberIds
            ? {
                in: query.memberId
                  ? memberIds.filter((m) => m === query.memberId)
                  : memberIds,
              }
            : query.memberId,
          ...(takenAt ? { takenAt } : {}),
        },
        orderBy: { takenAt: 'desc' },
        take: query.limit,
      });
    return rows.map(toTestResponse);
  }

  async listMaterialLogs(
    org: OrgContext,
    query: ListProgressQuery,
  ): Promise<MaterialLogResponse[]> {
    let courseId = query.courseId;
    if (query.sessionId)
      courseId = (await this.session(org, query.sessionId)).courseId;
    if (!courseId) throw badRequest('courseId', 'Choose a course or a session');
    const scope = await this.scope.forCourse(org, courseId, 'read');
    const rows = await this.prisma
      .forOrganization(org.organizationId)
      .materialLog.findMany({
        where: {
          session: { courseId },
          ...(query.sessionId ? { sessionId: query.sessionId } : {}),
          ...(query.materialId ? { materialId: query.materialId } : {}),
          ...(scope.groupIds
            ? { OR: [{ groupId: null }, { groupId: { in: scope.groupIds } }] }
            : {}),
        },
        orderBy: { loggedAt: 'desc' },
        take: query.limit,
      });
    return rows.map(toMaterialLogResponse);
  }

  // -------------------------------------------------------------------------
  // The class kit (SYNC-02)
  // -------------------------------------------------------------------------

  async classKit(org: OrgContext, now = new Date()): Promise<ClassKit> {
    const timezone = await this.timezone(org.organizationId);
    const date = dateIn(now, timezone);
    const kit: ClassKit = {
      kitVersion: now.toISOString(),
      generatedAt: now.toISOString(),
      date,
      timezone,
      memberId: org.memberId ?? '00000000-0000-0000-0000-000000000000',
      sessions: [],
      materials: [],
      positions: [],
      todayLogs: [],
      explanationProgress: [],
      recitationKinds: [],
      memberHifzMaps: [],
    };
    if (!org.memberId) return kit;

    const db = this.prisma.forOrganization(org.organizationId);
    const assignments = await db.teachingAssignment.findMany({
      where: {
        teacherMemberId: org.memberId,
        endedAt: null,
        course: { status: { in: ['ACTIVE', 'PAUSED'] } },
      },
      select: { courseId: true },
    });
    const courseIds = assignments.map((a) => a.courseId);
    if (courseIds.length === 0) {
      kit.recitationKinds = await this.recitationKindsFor(db);
      return kit;
    }

    const sessions = await db.courseSession.findMany({
      where: {
        courseId: { in: courseIds },
        date: fromDateString(date),
        status: { not: 'CANCELLED' },
      },
      include: { course: true, attendance: true },
      orderBy: { startsAt: 'asc' },
    });

    // The kit is a teacher's view even for staff who teach: their own students only.
    const asTeacher: OrgContext = { ...org, permissions: [] };
    const rosterMembers = new Set<string>();
    const kitCourses = new Set<string>();
    for (const s of sessions) {
      const scope = await this.scope.forCourse(asTeacher, s.courseId, 'read');
      const enrollments = await db.enrollment.findMany({
        where: this.scope.enrollmentFilter(scope),
        include: { member: true },
      });
      const markOf = new Map(
        s.attendance.map((a) => [a.enrollmentId, a.status]),
      );
      kitCourses.add(s.courseId);
      kit.sessions.push({
        id: s.id,
        courseId: s.courseId,
        courseName: s.course.name,
        courseType: s.course.type,
        testPassMark: s.course.testPassMark,
        date: toDateString(s.date),
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
        status: s.status,
        topic: s.topic,
        groupIds: scope.groupIds ?? [],
        roster: enrollments.sort(byName).map((e) => {
          rosterMembers.add(e.memberId);
          return {
            enrollmentId: e.id,
            memberId: e.memberId,
            name: memberName(e.member),
            attendance: markOf.get(e.id) ?? null,
          };
        }),
      });
    }

    const links = await db.courseMaterial.findMany({
      where: { courseId: { in: [...kitCourses] } },
      include: { material: true },
      orderBy: { order: 'asc' },
    });
    kit.materials = links.map((l) => ({
      courseId: l.courseId,
      materialId: l.materialId,
      title: l.material.title,
      kind: l.material.kind,
      track: l.track,
      totalPages: l.material.totalPages,
    }));

    const memorizationMaterials = links
      .filter((l) => l.track === 'MEMORIZATION')
      .map((l) => l.materialId);
    if (rosterMembers.size && memorizationMaterials.length) {
      const summaries = await db.memorizationSummary.findMany({
        where: {
          memberId: { in: [...rosterMembers] },
          materialId: { in: memorizationMaterials },
        },
      });
      kit.positions = summaries.map(toSummaryResponse);

      const dayStart = fromDateString(date);
      const dayEnd = fromDateString(addDays(date, 1));
      const logs = await db.memorizationLog.findMany({
        where: {
          memberId: { in: [...rosterMembers] },
          materialId: { in: memorizationMaterials },
          voidedAt: null,
          loggedAt: { gte: dayStart, lt: dayEnd },
        },
        orderBy: { loggedAt: 'asc' },
      });
      kit.todayLogs = logs.map((l) => ({
        id: l.id,
        memberId: l.memberId,
        materialId: l.materialId,
        type: l.type,
        pageFrom: l.pageFrom,
        pageTo: l.pageTo,
        countsProgress: l.countsProgress,
        loggedAt: l.loggedAt.toISOString(),
      }));

      const quranMaterialIds = links
        .filter((l) => l.track === 'MEMORIZATION' && l.material.kind === 'QURAN')
        .map((l) => l.materialId);
      if (quranMaterialIds.length) {
        const lifetimeLogs = await db.memorizationLog.findMany({
          where: {
            memberId: { in: [...rosterMembers] },
            materialId: { in: quranMaterialIds },
            voidedAt: null,
          },
          select: {
            memberId: true,
            materialId: true,
            type: true,
            voidedAt: true,
            surahStart: true,
            ayahStart: true,
            surahEnd: true,
            ayahEnd: true,
            pageFrom: true,
            pageTo: true,
            countsProgress: true,
          },
        });
        for (const materialId of quranMaterialIds) {
          for (const memberId of rosterMembers) {
            const slice = lifetimeLogs.filter(
              (l) => l.memberId === memberId && l.materialId === materialId,
            );
            kit.memberHifzMaps.push({
              memberId,
              materialId,
              juzMemorized: hifzMapFromData(slice, []).juzMemorized,
            });
          }
        }
      }
    }

    const sessionIds = kit.sessions.map((s) => s.id);
    if (sessionIds.length) {
      const materialLogs = await db.materialLog.findMany({
        where: { sessionId: { in: sessionIds } },
        orderBy: { loggedAt: 'asc' },
      });
      const furthest = new Map<string, { sessionId: string; materialId: string; groupId: string | null; pageTo: number }>();
      for (const row of materialLogs) {
        const key = `${row.sessionId}:${row.materialId}:${row.groupId ?? ''}`;
        const prev = furthest.get(key);
        if (!prev || row.pageTo > prev.pageTo) {
          furthest.set(key, {
            sessionId: row.sessionId,
            materialId: row.materialId,
            groupId: row.groupId,
            pageTo: row.pageTo,
          });
        }
      }
      kit.explanationProgress = [...furthest.values()];
    }

    kit.recitationKinds = await this.recitationKindsFor(db);

    return kit;
  }

  /** Course page halaqa wall (SC-DOD-2): positions and today's logs, online only. */
  async courseHalaqaWall(
    org: OrgContext,
    courseId: string,
    now = new Date(),
  ): Promise<CourseHalaqaWall> {
    const scope = await this.scope.forCourse(org, courseId, 'read');
    const db = this.prisma.forOrganization(org.organizationId);
    const timezone = await this.timezone(org.organizationId);
    const date = dateIn(now, timezone);
    const dayStart = fromDateString(date);
    const dayEnd = fromDateString(addDays(date, 1));

    const enrollments = await db.enrollment.findMany({
      where: this.scope.enrollmentFilter(scope),
      include: { member: true },
    });
    const memberIds = enrollments.map((e) => e.memberId);

    const links = await db.courseMaterial.findMany({
      where: { courseId },
      include: { material: true },
      orderBy: { order: 'asc' },
    });
    const memorizationIds = links
      .filter((l) => l.track === 'MEMORIZATION')
      .map((l) => l.materialId);
    const quranLink = links.find(
      (l) => l.track === 'MEMORIZATION' && l.material.kind === 'QURAN',
    );

    const summaries =
      memberIds.length && memorizationIds.length
        ? await db.memorizationSummary.findMany({
            where: {
              memberId: { in: memberIds },
              materialId: { in: memorizationIds },
            },
          })
        : [];
    const summaryOf = (memberId: string) => {
      const materialId = quranLink?.materialId ?? memorizationIds[0];
      if (!materialId) return null;
      const row = summaries.find(
        (s) => s.memberId === memberId && s.materialId === materialId,
      );
      return row ? toSummaryResponse(row) : null;
    };

    const todayLogs =
      memberIds.length && memorizationIds.length
        ? await db.memorizationLog.findMany({
            where: {
              courseId,
              memberId: { in: memberIds },
              materialId: { in: memorizationIds },
              voidedAt: null,
              loggedAt: { gte: dayStart, lt: dayEnd },
            },
          })
        : [];
    const logCount = new Map<string, number>();
    for (const log of todayLogs) {
      logCount.set(log.memberId, (logCount.get(log.memberId) ?? 0) + 1);
    }

    const juzByMember = new Map<string, number[]>();
    if (memberIds.length && quranLink) {
      const lifetimeLogs = await db.memorizationLog.findMany({
        where: {
          memberId: { in: memberIds },
          materialId: quranLink.materialId,
          voidedAt: null,
        },
        select: {
          memberId: true,
          type: true,
          voidedAt: true,
          surahStart: true,
          ayahStart: true,
          surahEnd: true,
          ayahEnd: true,
          pageFrom: true,
          pageTo: true,
          countsProgress: true,
        },
      });
      for (const memberId of memberIds) {
        const slice = lifetimeLogs.filter((l) => l.memberId === memberId);
        juzByMember.set(
          memberId,
          hifzMapFromData(slice, []).juzMemorized,
        );
      }
    }

    const explanationLinks = links.filter((l) => l.track === 'EXPLANATION');
    let explanation: CourseHalaqaWall['explanation'] = null;
    if (explanationLinks.length) {
      const sessionRows = await db.courseSession.findMany({
        where: { courseId, status: { not: 'CANCELLED' } },
        select: { id: true },
      });
      if (sessionRows.length) {
        const materialLogs = await db.materialLog.findMany({
          where: {
            sessionId: { in: sessionRows.map((s) => s.id) },
            materialId: { in: explanationLinks.map((l) => l.materialId) },
          },
        });
        let best: { materialId: string; pageTo: number } | null = null;
        for (const row of materialLogs) {
          if (!best || row.pageTo > best.pageTo)
            best = { materialId: row.materialId, pageTo: row.pageTo };
        }
        if (best) {
          const link = explanationLinks.find(
            (l) => l.materialId === best!.materialId,
          )!;
          explanation = {
            materialId: link.materialId,
            title: link.material.title,
            pageTo: best.pageTo,
            totalPages: link.material.totalPages,
          };
        }
      }
    }

    return {
      date,
      testPassMark: scope.course.testPassMark,
      explanation,
      students: enrollments.sort(byName).map((e) => ({
        memberId: e.memberId,
        name: memberName(e.member),
        position: summaryOf(e.memberId),
        loggedToday: (logCount.get(e.memberId) ?? 0) > 0,
        todayLogCount: logCount.get(e.memberId) ?? 0,
        juzMemorized: juzByMember.get(e.memberId),
      })),
    };
  }

  private async recitationKindsFor(
    db: ReturnType<PrismaService['forOrganization']>,
  ) {
    const kinds = await db.recitationKind.findMany({
      where: { active: true, archivedAt: null },
      orderBy: { name: 'asc' },
    });
    return kinds.map((k) => ({ id: k.id, name: k.name, active: k.active }));
  }
}
