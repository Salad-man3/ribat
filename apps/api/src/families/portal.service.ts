import { Injectable } from '@nestjs/common';
import type { AttendanceStatus } from '@prisma/client';
import type {
  AttendanceCounts,
  MemberProgressResponse,
  ScheduleEntry,
  ScheduleQuery,
  ScheduleResponse,
} from '@ribat/shared';
import type { OrgContext } from '../auth/org-context.guard';
import { badRequest } from '../common/errors';
import { addDays, dateIn, fromDateString, toDateString } from '../common/zoned-time';
import { memberName } from '../courses/course.mapper';
import { PrismaService } from '../prisma/prisma.service';
import { hifzMapFromData } from '../progress/hifz-map';
import { toSummaryResponse, toTestResponse } from '../progress/progress.mapper';
import { ExcusesService } from './excuses.service';
import { MemberAccessService } from './member-access.service';

const MAX_RANGE_DAYS = 31;

export function attendanceCounts(statuses: AttendanceStatus[]): AttendanceCounts {
  const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
  for (const s of statuses) counts[s] += 1;
  const total = statuses.length;
  return { ...counts, total, rate: total ? (counts.PRESENT + counts.LATE) / total : null };
}

/** T401–T403: what a family sees without asking staff over WhatsApp. */
@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MemberAccessService,
    private readonly excuses: ExcusesService,
  ) {}

  /** Decision 16.2: one timetable for teaching, studying and every ward, Hijri dates added by the client. */
  async schedule(org: OrgContext, query: ScheduleQuery): Promise<ScheduleResponse> {
    const { timezone } = await this.prisma.platform.organization.findUniqueOrThrow({
      where: { id: org.organizationId },
      select: { timezone: true },
    });
    const from = query.from ?? dateIn(new Date(), timezone);
    const to = query.to ?? addDays(from, 6);
    if (to > addDays(from, MAX_RANGE_DAYS)) throw badRequest('to', `At most ${MAX_RANGE_DAYS} days`);
    const response: ScheduleResponse = { from, to, timezone, entries: [] };
    if (!org.memberId) return response;

    const db = this.prisma.forOrganization(org.organizationId);
    const { wards } = await this.access.family(org);
    const [teaching, enrollments, members] = await Promise.all([
      db.teachingAssignment.findMany({ where: { teacherMemberId: org.memberId, endedAt: null }, select: { courseId: true } }),
      db.enrollment.findMany({
        where: { memberId: { in: [org.memberId, ...wards] }, status: 'ACTIVE' },
        select: { courseId: true, memberId: true },
      }),
      db.member.findMany({ where: { id: { in: [org.memberId, ...wards] } } }),
    ]);
    const names = new Map(members.map((m) => [m.id, memberName(m)]));
    const reasons = new Map<string, { role: ScheduleEntry['role']; memberId: string }[]>();
    const add = (courseId: string, role: ScheduleEntry['role'], memberId: string) =>
      reasons.set(courseId, [...(reasons.get(courseId) ?? []), { role, memberId }]);
    for (const t of teaching) add(t.courseId, 'TEACHING', org.memberId);
    for (const e of enrollments) add(e.courseId, e.memberId === org.memberId ? 'STUDYING' : 'WARD', e.memberId);
    if (reasons.size === 0) return response;

    const sessions = await db.courseSession.findMany({
      where: {
        courseId: { in: [...reasons.keys()] },
        date: { gte: fromDateString(from), lte: fromDateString(to) },
        course: { status: { in: ['ACTIVE', 'PAUSED'] } },
      },
      include: { course: { select: { name: true } } },
      orderBy: { startsAt: 'asc' },
    });
    response.entries = sessions.flatMap((s) =>
      (reasons.get(s.courseId) ?? []).map((r) => ({
        sessionId: s.id,
        courseId: s.courseId,
        courseName: s.course.name,
        date: toDateString(s.date),
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
        status: s.status,
        topic: s.topic,
        role: r.role,
        memberId: r.memberId,
        memberName: names.get(r.memberId) ?? '',
      })),
    );
    return response;
  }

  /** The member card's numbers (PERM-07). Teacher notes are never part of it (DM-13). */
  async progress(org: OrgContext, memberId: string): Promise<MemberProgressResponse> {
    const { member } = await this.access.relation(org, memberId);
    const db = this.prisma.forOrganization(org.organizationId);
    const enrollments = await db.enrollment.findMany({
      where: { memberId },
      include: { course: { select: { name: true } } },
    });
    const enrollmentIds = enrollments.map((e) => e.id);
    const quranMaterial = await db.material.findFirst({
      where: { organizationId: org.organizationId, kind: 'QURAN' },
    });
    const [marks, summaries, tests, tasks, excuses, quranLogs, awqafExams] =
      await Promise.all([
      db.attendance.findMany({
        where: { enrollmentId: { in: enrollmentIds } },
        include: { session: { select: { date: true } } },
        orderBy: { session: { date: 'desc' } },
      }),
      db.memorizationSummary.findMany({ where: { memberId }, include: { material: true } }),
      db.memorizationTest.findMany({ where: { memberId }, orderBy: { takenAt: 'desc' }, take: 20 }),
      db.homeworkTask.findMany({
        where: { enrollmentId: { in: enrollmentIds } },
        include: { homework: true },
        orderBy: { homework: { dueDate: 'desc' } },
        take: 30,
      }),
      db.excuseRequest.findMany({ where: { memberId }, orderBy: { createdAt: 'desc' }, take: 20 }),
      quranMaterial
        ? db.memorizationLog.findMany({
            where: { memberId, materialId: quranMaterial.id },
          })
        : Promise.resolve([]),
      db.awqafExam.findMany({
        where: { memberId },
        include: { juzResults: true },
        orderBy: { takenAt: 'desc' },
      }),
    ]);
    const courseOf = new Map(enrollments.map((e) => [e.id, e.course.name]));

    return {
      memberId,
      memberName: memberName(member),
      courses: enrollments.map((e) => ({
        courseId: e.courseId,
        courseName: e.course.name,
        enrollmentStatus: e.status,
        attendance: attendanceCounts(marks.filter((m) => m.enrollmentId === e.id).map((m) => m.status)),
      })),
      recentAttendance: marks.slice(0, 20).map((m) => ({
        date: toDateString(m.session.date),
        courseName: courseOf.get(m.enrollmentId) ?? '',
        status: m.status,
      })),
      summaries: summaries.map((s) => ({
        ...toSummaryResponse(s),
        materialTitle: s.material.title,
        materialKind: s.material.kind,
      })),
      tests: tests.map(toTestResponse),
      homework: tasks.map((t) => ({
        taskId: t.id,
        homeworkId: t.homeworkId,
        title: t.homework.title,
        description: t.homework.description,
        courseName: courseOf.get(t.enrollmentId) ?? '',
        dueDate: toDateString(t.homework.dueDate),
        status: t.status,
      })),
      excuses: await this.excuses.present(org.organizationId, excuses),
      hifz: quranMaterial
        ? {
            ...hifzMapFromData(quranLogs, tests),
            awqafByJuz: awqafExams.flatMap((exam) =>
              exam.juzResults.map((j) => ({
                juz: j.juz,
                passed: j.passed,
                score: j.score,
                level: exam.level,
                takenAt: exam.takenAt.toISOString(),
              })),
            ),
          }
        : null,
    };
  }
}
