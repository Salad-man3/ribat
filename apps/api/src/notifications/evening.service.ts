import { Injectable } from '@nestjs/common';
import { dateIn, fromDateString, toDateString } from '../common/zoned-time';
import { memberName } from '../courses/course.mapper';
import { emit } from '../events/emit';
import { PrismaService } from '../prisma/prisma.service';
import { identitiesOf, notify } from './notify';

const RETENTION_DAYS = 90;

/**
 * The nightly jobs of 07-events-and-jobs §5, run once per organization at its own end of day.
 * Each is keyed so a second run the same evening writes nothing new.
 */
@Injectable()
export class EveningService {
  // ponytail: one fixed end of day for every mosque; make it an organization setting if one asks.
  static readonly HOUR = 21;
  static readonly MINUTE = 30;

  constructor(private readonly prisma: PrismaService) {}

  async run(organizationId: string, now = new Date()) {
    const org = await this.prisma.platform.organization.findUniqueOrThrow({ where: { id: organizationId } });
    const date = dateIn(now, org.timezone);
    return {
      date,
      absenceSummaries: await this.absenceSummary(organizationId, date),
      notTaken: await this.notTakenAlert(organizationId, date, now),
      homeworkMissed: await this.homeworkDueCheck(organizationId, date),
      pruned: await this.prune(organizationId, now),
    };
  }

  /** T409, decision 8.4: one notification per guardian per day, listing every ward's absences and lateness. */
  async absenceSummary(organizationId: string, date: string): Promise<number> {
    const db = this.prisma.forOrganization(organizationId);
    const marks = await db.attendance.findMany({
      where: { status: { in: ['ABSENT', 'LATE'] }, session: { date: fromDateString(date) } },
      include: { enrollment: { include: { member: true } }, session: { include: { course: true } } },
    });
    if (marks.length === 0) return 0;

    const links = await db.guardianLink.findMany({
      where: { wardMemberId: { in: marks.map((m) => m.enrollment.memberId) } },
    });
    const byGuardian = new Map<string, typeof marks>();
    for (const link of links)
      byGuardian.set(link.guardianMemberId, [
        ...(byGuardian.get(link.guardianMemberId) ?? []),
        ...marks.filter((m) => m.enrollment.memberId === link.wardMemberId),
      ]);

    let sent = 0;
    for (const [guardianMemberId, items] of byGuardian) {
      const recipients = await identitiesOf(db, [guardianMemberId]);
      sent += await notify(
        db,
        organizationId,
        recipients,
        {
          type: 'ABSENCE_SUMMARY',
          params: {
            date,
            count: items.length,
            // Structured, so each reader sees the status in their own language.
            items: items.map((m) => ({
              student: memberName(m.enrollment.member),
              course: m.session.course.name,
              status: m.status,
            })),
          },
        },
        `absence:${date}:${guardianMemberId}`,
      );
    }
    return sent;
  }

  /** T410, decision 8.6: a past, not cancelled session with no attendance tells the staff. */
  async notTakenAlert(organizationId: string, date: string, now: Date): Promise<number> {
    const db = this.prisma.forOrganization(organizationId);
    const sessions = await db.courseSession.findMany({
      where: {
        date: fromDateString(date),
        status: 'SCHEDULED',
        endsAt: { lt: now },
        attendance: { none: {} },
        course: { status: 'ACTIVE' },
      },
      include: { course: true },
    });
    if (sessions.length === 0) return 0;
    const staff = await db.membership.findMany({
      where: { role: { in: ['SHEIKH', 'ORG_ADMIN'] }, status: 'ACTIVE' },
      select: { identityId: true },
    });
    let sent = 0;
    for (const s of sessions)
      sent += await notify(
        db,
        organizationId,
        staff.map((m) => m.identityId),
        {
          type: 'SESSION_NOT_TAKEN',
          params: { course: s.course.name, date: toDateString(s.date), startsAt: s.startsAt.toISOString() },
          entityType: 'course_session',
          entityId: s.id,
        },
        `nottaken:${s.id}`,
      );
    return sent;
  }

  /** Homework still open after its due date becomes MISSED and emits `homework.missed`. */
  async homeworkDueCheck(organizationId: string, date: string): Promise<number> {
    const db = this.prisma.forOrganization(organizationId);
    const overdue = await db.homeworkTask.findMany({
      where: { status: 'ASSIGNED', homework: { dueDate: { lt: fromDateString(date) } } },
      include: { homework: true },
    });
    const enrollments = await db.enrollment.findMany({
      where: { id: { in: overdue.map((t) => t.enrollmentId) } },
      select: { id: true, memberId: true },
    });
    const memberOf = new Map(enrollments.map((e) => [e.id, e.memberId]));
    for (const task of overdue)
      await db.$transaction(async (tx) => {
        const { count } = await tx.homeworkTask.updateMany({
          where: { id: task.id, status: 'ASSIGNED' },
          data: { status: 'MISSED', markedAt: new Date() },
        });
        if (count === 0) return; // marked done meanwhile
        await emit(
          tx,
          { organizationId, requestId: `job:evening:${date}`, actorMembershipId: null },
          {
            type: 'homework.missed',
            aggregateType: 'homework',
            aggregateId: task.homeworkId,
            payload: { homeworkId: task.homeworkId, taskId: task.id, memberId: memberOf.get(task.enrollmentId) ?? null },
          },
        );
      });
    return overdue.length;
  }

  /** retention.prune: read notifications only; never domain data. */
  async prune(organizationId: string, now: Date): Promise<number> {
    const { count } = await this.prisma.forOrganization(organizationId).notification.deleteMany({
      where: { readAt: { lt: new Date(now.getTime() - RETENTION_DAYS * 86_400_000) } },
    });
    return count;
  }
}
