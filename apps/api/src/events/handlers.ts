import type { DomainEvent } from '@prisma/client';
import { memberName } from '../courses/course.mapper';
import { toDateString } from '../common/zoned-time';
import { identitiesOf, notify, withGuardians } from '../notifications/notify';
import type { OrgTx } from '../prisma/prisma.service';
import type { EventPayload, EventType } from './emit';
import { resolveAnnouncementMemberIdsForDelivery } from '../announcements/announcement-audience';

type Handler = (tx: OrgTx, event: DomainEvent, p: EventPayload) => Promise<void>;
const str = (v: EventPayload[string]) => (typeof v === 'string' ? v : '');

/**
 * Reactions only (EV-01): nothing a person sees as a record depends on these running.
 * Each runs in one transaction with its delivery row, and every write is deduplicated
 * by event id, so a redelivery changes nothing (EV-03).
 */
export const HANDLERS: Record<string, Handler> = {
  /** Decision 9.4: the person whose attendance mark was overwritten hears about it. */
  'notify.attendanceOverridden': async (tx, event, p) => {
    const replaced = str(p.supersededMemberId);
    if (!replaced || replaced === str(p.markedByMemberId)) return;
    const [enrollment, session] = await Promise.all([
      tx.enrollment.findFirst({ where: { id: str(p.enrollmentId) }, include: { member: true } }),
      tx.courseSession.findFirst({ where: { id: str(p.sessionId) }, include: { course: true } }),
    ]);
    if (!enrollment || !session) return;
    await notify(
      tx,
      event.organizationId,
      await identitiesOf(tx, [replaced]),
      {
        type: 'ATTENDANCE_OVERRIDDEN',
        params: {
          student: memberName(enrollment.member),
          course: session.course.name,
          date: toDateString(session.date),
          status: str(p.status),
        },
        entityType: 'course_session',
        entityId: session.id,
      },
      `${event.id}:overridden`,
    );
  },

  /** WF-07 step 4: guardian and student. */
  'notify.testResult': async (tx, event, p) => {
    const test = await tx.memorizationTest.findFirst({
      where: { id: str(p.testId) },
      include: { member: true, course: true },
    });
    if (!test) return;
    await notify(
      tx,
      event.organizationId,
      await identitiesOf(tx, await withGuardians(tx, [test.memberId])),
      {
        type: 'TEST_RESULT',
        params: {
          student: memberName(test.member),
          course: test.course?.name ?? null,
          score: test.score,
          passed: test.passed,
        },
        entityType: 'member',
        entityId: test.memberId,
      },
      `${event.id}:test`,
    );
  },

  'notify.homeworkAssigned': async (tx, event, p) => {
    const homework = await tx.homework.findFirst({
      where: { id: str(p.homeworkId) },
      include: { tasks: { select: { enrollmentId: true } } },
    });
    if (!homework) return;
    const [course, enrollments] = await Promise.all([
      tx.course.findFirst({ where: { id: homework.courseId } }),
      tx.enrollment.findMany({
        where: { id: { in: homework.tasks.map((t) => t.enrollmentId) } },
        select: { memberId: true },
      }),
    ]);
    await notify(
      tx,
      event.organizationId,
      await identitiesOf(tx, await withGuardians(tx, enrollments.map((e) => e.memberId))),
      {
        type: 'HOMEWORK_ASSIGNED',
        params: { title: homework.title, course: course?.name ?? '', dueDate: toDateString(homework.dueDate) },
        entityType: 'homework',
        entityId: homework.id,
      },
      `${event.id}:homework`,
    );
  },

  /** Decision 10.4: the student, the guardians and the teacher who set it. */
  'notify.homeworkMissed': async (tx, event, p) => {
    const homework = await tx.homework.findFirst({ where: { id: str(p.homeworkId) } });
    const member = await tx.member.findFirst({ where: { id: str(p.memberId) } });
    if (!homework || !member) return;
    const people = [...(await withGuardians(tx, [member.id])), homework.createdByMemberId];
    await notify(
      tx,
      event.organizationId,
      await identitiesOf(tx, people),
      {
        type: 'HOMEWORK_MISSED',
        params: { title: homework.title, student: memberName(member), dueDate: toDateString(homework.dueDate) },
        entityType: 'homework',
        entityId: homework.id,
      },
      `${event.id}:missed`,
    );
  },

  'notify.sessionCancelled': async (tx, event, p) => {
    const session = await tx.courseSession.findFirst({ where: { id: str(p.sessionId) }, include: { course: true } });
    if (!session) return;
    const enrolled = await tx.enrollment.findMany({
      where: { courseId: session.courseId, status: 'ACTIVE' },
      select: { memberId: true },
    });
    await notify(
      tx,
      event.organizationId,
      await identitiesOf(tx, await withGuardians(tx, enrolled.map((e) => e.memberId))),
      {
        type: 'SCHEDULE_CHANGE',
        params: { course: session.course.name, date: toDateString(session.date), startsAt: session.startsAt.toISOString() },
        entityType: 'course_session',
        entityId: session.id,
      },
      `${event.id}:cancelled`,
    );
  },

  'notify.excuseDecided': async (tx, event, p) => {
    const excuse = await tx.excuseRequest.findFirst({ where: { id: str(p.excuseId) } });
    const member = excuse && (await tx.member.findFirst({ where: { id: excuse.memberId } }));
    if (!excuse || !member) return;
    await notify(
      tx,
      event.organizationId,
      [excuse.submittedByIdentityId],
      {
        type: 'EXCUSE_DECIDED',
        params: {
          student: memberName(member),
          decision: excuse.status,
          fromDate: toDateString(excuse.fromDate),
          toDate: toDateString(excuse.toDate),
        },
        entityType: 'excuse',
        entityId: excuse.id,
      },
      `${event.id}:excuse`,
    );
  },

  'notify.announcement': async (tx, event, p) => {
    const row = await tx.announcement.findFirst({ where: { id: str(p.announcementId) } });
    if (!row) return;
    const memberIds = await resolveAnnouncementMemberIdsForDelivery(tx, row);
    if (memberIds.length === 0) return;
    await notify(
      tx,
      event.organizationId,
      await identitiesOf(tx, await withGuardians(tx, memberIds)),
      {
        type: 'ANNOUNCEMENT',
        params: { title: row.title, body: row.body },
        entityType: 'announcement',
        entityId: row.id,
      },
      `${event.id}:announcement`,
    );
  },

  /** WF-12: guardian, student, and teacher when a report card is published. */
  'notify.reportCard': async (tx, event, p) => {
    const card = await tx.reportCard.findFirst({
      where: { id: str(p.reportId) },
      include: { member: true, course: { select: { name: true } } },
    });
    if (!card) return;
    const teacherIds = card.courseId
      ? (
          await tx.teachingAssignment.findMany({
            where: { courseId: card.courseId, endedAt: null },
            select: { teacherMemberId: true },
          })
        ).map((t) => t.teacherMemberId)
      : [];
    const recipients = await identitiesOf(
      tx,
      await withGuardians(tx, [card.memberId, ...teacherIds]),
    );
    await notify(
      tx,
      event.organizationId,
      recipients,
      {
        type: 'REPORT_CARD',
        params: {
          student: memberName(card.member),
          course: card.course?.name ?? null,
          periodStart: toDateString(card.periodStart),
          periodEnd: toDateString(card.periodEnd),
        },
        entityType: 'report_card',
        entityId: card.id,
      },
      `${event.id}:report`,
    );
  },

  /** WF-10: enrollments close, logins stop; history stays. Every step is a no-op the second time. */
  'members.closeOnArchive': async (tx, _event, p) => {
    const memberId = str(p.memberId);
    const today = new Date(new Date().toISOString().slice(0, 10));
    const enrollments = await tx.enrollment.findMany({ where: { memberId, status: 'ACTIVE' }, select: { id: true } });
    const ids = enrollments.map((e) => e.id);
    await tx.groupMember.deleteMany({ where: { enrollmentId: { in: ids } } });
    await tx.enrollment.updateMany({ where: { id: { in: ids } }, data: { status: 'WITHDRAWN', endedAt: today } });
    const memberships = await tx.membership.findMany({ where: { memberId, status: 'ACTIVE' }, select: { id: true, identityId: true } });
    await tx.membership.updateMany({ where: { id: { in: memberships.map((m) => m.id) } }, data: { status: 'SUSPENDED' } });
    await tx.authSession.updateMany({
      where: { identityId: { in: memberships.map((m) => m.identityId) }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
};

/** Which handlers react to which event. Events with no subscriber are still stored, for S5 to read. */
export const SUBSCRIPTIONS: Record<EventType, (keyof typeof HANDLERS)[]> = {
  'attendance.marked': ['notify.attendanceOverridden'],
  'memorization.logged': [],
  'test.recorded': ['notify.testResult'],
  'homework.assigned': ['notify.homeworkAssigned'],
  'homework.missed': ['notify.homeworkMissed'],
  'session.cancelled': ['notify.sessionCancelled'],
  'excuse.decided': ['notify.excuseDecided'],
  'member.archived': ['members.closeOnArchive'],
  'announcement.sent': ['notify.announcement'],
  'report.published': ['notify.reportCard'],
};
