process.env.JOBS_WORKER = 'off';
import 'dotenv/config';
// Its own Redis database: a running dev worker must not pick up the deliveries these tests drive by hand.
process.env.REDIS_URL = `${(process.env.REDIS_URL ?? '').replace(/\/\d+$/, '')}/15`;
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/api-exception.filter';
import { addDays, dateIn } from '../src/common/zoned-time';
import { emit } from '../src/events/emit';
import { OutboxService } from '../src/events/outbox.service';
import { EveningService } from '../src/notifications/evening.service';
import { organizationScopeExtension } from '../src/prisma/organization-scope';
import { loginAs, removeAuthFixtures, type AuthenticatedSession } from './fixtures/auth-session';
import { removeTwoOrganizations, twoOrganizations, type TwoOrganizations } from './fixtures/organizations';

const prisma = new PrismaClient();
const TZ = 'Asia/Damascus';

describe('Families, homework, notifications and the event outbox (S4, e2e)', () => {
  let app: INestApplication<App>;
  let outbox: OutboxService;
  let evening: EveningService;
  let orgs: TwoOrganizations;
  let sheikh: AuthenticatedSession;
  let otherSheikh: AuthenticatedSession;
  let teacher: AuthenticatedSession;
  let guardian: AuthenticatedSession;
  let ward: AuthenticatedSession;
  const sessions: AuthenticatedSession[] = [];
  let teacherMemberId: string;
  let wardMemberId: string;
  let guardianMemberId: string;
  let strangerMemberId: string;
  let courseId: string;
  let sessionId: string;
  let wardEnrollmentId: string;
  let quranId: string;

  const http = () => request(app.getHttpServer());
  const api = (s: AuthenticatedSession) => ({
    get: (path: string) => http().get(`/api/v1${path}`).set('cookie', s.cookie),
    post: (path: string, body: object = {}) =>
      http().post(`/api/v1${path}`).set('cookie', s.cookie).set(s.csrfHeader, s.csrf).send(body),
    patch: (path: string, body: object) =>
      http().patch(`/api/v1${path}`).set('cookie', s.cookie).set(s.csrfHeader, s.csrf).send(body),
  });
  const today = () => dateIn(new Date(), TZ);
  const memberIdOf = async (s: AuthenticatedSession) =>
    (await prisma.membership.findFirstOrThrow({ where: { identityId: s.identityId } })).memberId!;
  const mark = (s: AuthenticatedSession, enrollmentId: string, status: string, sid = sessionId) =>
    api(s)
      .post(`/sessions/${sid}/attendance`, { marks: [{ idempotencyKey: randomUUID(), enrollmentId, status }] })
      .expect(200);
  const inbox = async (s: AuthenticatedSession) => (await api(s).get('/notifications').expect(200)).body;

  /** What the worker does: dispatch every undispatched event, then run each delivery. */
  async function drain() {
    await outbox.dispatchOnce();
    const pending = await prisma.eventDelivery.findMany({
      where: { status: 'PENDING', event: { organizationId: orgs.demo.id } },
    });
    for (const d of pending) await outbox.deliver(d.id, false);
  }

  beforeAll(async () => {
    orgs = await twoOrganizations(prisma, 'e2e-s4');
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication({ bufferLogs: true });
    app.useLogger(app.get(Logger));
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    outbox = app.get(OutboxService);
    evening = app.get(EveningService);

    sheikh = await loginAs(prisma, app, orgs.demo.id, 'SHEIKH');
    otherSheikh = await loginAs(prisma, app, orgs.other.id, 'SHEIKH');
    teacher = await loginAs(prisma, app, orgs.demo.id, 'MEMBER');
    guardian = await loginAs(prisma, app, orgs.demo.id, 'GUARDIAN');
    ward = await loginAs(prisma, app, orgs.demo.id, 'MEMBER');
    sessions.push(sheikh, otherSheikh, teacher, guardian, ward);
    teacherMemberId = await memberIdOf(teacher);
    wardMemberId = await memberIdOf(ward);
    guardianMemberId = await memberIdOf(guardian);
    await prisma.guardianLink.create({
      data: { organizationId: orgs.demo.id, guardianMemberId, wardMemberId, relation: 'FATHER', isPrimary: true },
    });
    strangerMemberId = (
      await api(sheikh)
        .post('/members', { firstName: 'Stranger', fatherName: 'S4', familyName: 'Test', birthDate: '2013-01-01', joinedAt: '2026-09-01' })
        .expect(201)
    ).body.id;

    quranId = (
      await prisma.material.create({ data: { organizationId: orgs.demo.id, kind: 'QURAN', title: 'Quran', totalPages: 604 } })
    ).id;
    courseId = (await api(sheikh).post('/courses', { name: 'Maghrib halaqa', type: 'MEMORIZATION' }).expect(201)).body.id;
    await api(sheikh).post(`/courses/${courseId}/materials`, { materialId: quranId, track: 'MEMORIZATION' }).expect(201);
    await api(sheikh).post(`/courses/${courseId}/teachers`, { memberId: teacherMemberId }).expect(201);
    await api(sheikh).post(`/courses/${courseId}/status`, { status: 'ACTIVE' }).expect(201);
    wardEnrollmentId = (await api(sheikh).post(`/courses/${courseId}/enrollments`, { memberId: wardMemberId }).expect(201)).body
      .enrollment.id;
    await api(sheikh).post(`/courses/${courseId}/enrollments`, { memberId: strangerMemberId }).expect(201);
    sessionId = (
      await api(sheikh).post(`/courses/${courseId}/sessions`, { date: today(), startTime: '00:01', endTime: '23:59' }).expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await removeAuthFixtures(prisma, sessions.map((s) => s.identityId));
    await removeTwoOrganizations(prisma, orgs);
    await app.close();
    await prisma.$disconnect();
  });

  describe('timetable and progress (T401–T403)', () => {
    it("a guardian sees their ward's week; a teacher sees what they teach", async () => {
      const mine = await api(guardian).get('/schedule').expect(200);
      expect(mine.body.entries).toEqual([
        expect.objectContaining({ sessionId, role: 'WARD', memberId: wardMemberId }),
      ]);
      const taught = await api(teacher).get('/schedule').expect(200);
      expect(taught.body.entries.map((e: { role: string }) => e.role)).toEqual(['TEACHING']);
      await api(guardian).get(`/schedule?from=${today()}&to=${addDays(today(), 40)}`).expect(400);
    });

    it('progress is for staff, the member and their guardians only (DM-14)', async () => {
      await mark(teacher, wardEnrollmentId, 'LATE');
      const res = await api(guardian).get(`/members/${wardMemberId}/progress`).expect(200);
      expect(res.body.courses[0].attendance).toMatchObject({ LATE: 1, total: 1, rate: 1 });
      await api(ward).get(`/members/${wardMemberId}/progress`).expect(200);
      await api(guardian).get(`/members/${strangerMemberId}/progress`).expect(403);
      await api(teacher).get(`/members/${wardMemberId}/progress`).expect(403);
      await api(otherSheikh).get(`/members/${wardMemberId}/progress`).expect(404);
    });
  });

  describe('excuses (T404, decision 8.3)', () => {
    it('a guardian submits for a ward; accepting excuses past and later absences', async () => {
      await mark(teacher, wardEnrollmentId, 'ABSENT');
      await api(guardian)
        .post('/excuses', { memberId: strangerMemberId, fromDate: today(), toDate: today(), reason: 'Not mine' })
        .expect(403);
      const excuse = await api(guardian)
        .post('/excuses', { memberId: wardMemberId, fromDate: today(), toDate: addDays(today(), 2), reason: 'Fever' })
        .expect(201);
      expect(excuse.body.status).toBe('PENDING');

      await api(teacher).post(`/excuses/${excuse.body.id}/decision`, { decision: 'ACCEPTED' }).expect(403);
      await api(otherSheikh).post(`/excuses/${excuse.body.id}/decision`, { decision: 'ACCEPTED' }).expect(404);
      await api(sheikh).post(`/excuses/${excuse.body.id}/decision`, { decision: 'ACCEPTED' }).expect(201);
      await api(sheikh).post(`/excuses/${excuse.body.id}/decision`, { decision: 'REJECTED' }).expect(409);

      const row = await prisma.attendance.findFirstOrThrow({ where: { sessionId, enrollmentId: wardEnrollmentId } });
      expect(row.status).toBe('EXCUSED');
      // A later "absent" on a covered day is recorded as excused.
      await mark(sheikh, wardEnrollmentId, 'ABSENT');
      expect((await prisma.attendance.findFirstOrThrow({ where: { id: row.id } })).status).toBe('EXCUSED');

      await drain();
      const notes = await inbox(guardian);
      expect(notes.items.map((n: { type: string }) => n.type)).toContain('EXCUSE_DECIDED');

      const listed = await api(guardian).get('/excuses').expect(200);
      expect(listed.body).toHaveLength(1);
      expect((await api(otherSheikh).get('/excuses').expect(200)).body).toEqual([]);
    });
  });

  describe('homework (T405)', () => {
    it('assigns to the course, notifies families, is marked done, and goes missed after the due date', async () => {
      await api(guardian).post('/homework', { courseId, targetType: 'COURSE', title: 'x', dueDate: today() }).expect(403);
      const hw = await api(teacher)
        .post('/homework', { courseId, targetType: 'COURSE', title: 'Revise An-Naba', dueDate: addDays(today(), -1) })
        .expect(201);
      expect(hw.body.counts).toEqual({ ASSIGNED: 2, DONE: 0, MISSED: 0 });
      const single = await api(teacher)
        .post('/homework', { courseId, targetType: 'MEMBER', memberId: wardMemberId, title: 'Memorize Al-Mulk 1–5', dueDate: addDays(today(), 3) })
        .expect(201);
      expect(single.body.counts.ASSIGNED).toBe(1);

      const tasks = await api(teacher).get(`/homework/${hw.body.id}/tasks`).expect(200);
      const strangerTask = tasks.body.find((t: { memberId: string }) => t.memberId === strangerMemberId);
      await api(teacher).patch(`/homework/tasks/${strangerTask.id}`, { status: 'DONE' }).expect(204);
      await api(ward).patch(`/homework/tasks/${strangerTask.id}`, { status: 'ASSIGNED' }).expect(403);

      await drain();
      expect((await inbox(guardian)).items.map((n: { type: string }) => n.type)).toContain('HOMEWORK_ASSIGNED');

      // The nightly check: the ward's overdue task goes MISSED and tells the family and the teacher.
      const result = await evening.run(orgs.demo.id);
      expect(result.homeworkMissed).toBe(1);
      await drain();
      expect((await inbox(teacher)).items.map((n: { type: string }) => n.type)).toContain('HOMEWORK_MISSED');
      const progress = await api(guardian).get(`/members/${wardMemberId}/progress`).expect(200);
      expect(progress.body.homework.map((h: { status: string }) => h.status).sort()).toEqual(['ASSIGNED', 'MISSED']);
      // A second run the same evening changes nothing.
      expect((await evening.run(orgs.demo.id)).homeworkMissed).toBe(0);
    });
  });

  describe('notifications (T406, T409, T410)', () => {
    it('tells a teacher their mark was overridden, and marks the inbox read', async () => {
      const s2 = (
        await api(sheikh).post(`/courses/${courseId}/sessions`, { date: today(), startTime: '00:00', endTime: '00:01' }).expect(201)
      ).body.id;
      const strangerEnrollment = (await prisma.enrollment.findFirstOrThrow({ where: { courseId, memberId: strangerMemberId } })).id;
      await mark(sheikh, strangerEnrollment, 'PRESENT', s2);
      await mark(teacher, strangerEnrollment, 'ABSENT', s2); // a later mark wins
      await drain();
      const notes = await inbox(sheikh);
      const overridden = notes.items.find((n: { type: string }) => n.type === 'ATTENDANCE_OVERRIDDEN');
      expect(overridden).toMatchObject({ titleKey: 'notifications.ATTENDANCE_OVERRIDDEN.title' });
      expect(overridden.params).toMatchObject({ status: 'ABSENT' });

      await api(sheikh).post('/notifications/read', { all: true }).expect(204);
      expect((await inbox(sheikh)).unread).toBe(0);
      // Nobody reads another person's inbox.
      expect((await inbox(teacher)).items.find((n: { id: string }) => n.id === overridden.id)).toBeUndefined();
    });

    it("the evening job sends one absence summary per guardian, and tells staff about a session nobody took", async () => {
      const late = (
        await api(sheikh).post(`/courses/${courseId}/sessions`, { date: today(), startTime: '00:02', endTime: '00:03' }).expect(201)
      ).body.id;
      const lateClass = (
        await api(sheikh).post(`/courses/${courseId}/sessions`, { date: today(), startTime: '00:06', endTime: '23:00' }).expect(201)
      ).body.id;
      await mark(teacher, wardEnrollmentId, 'LATE', lateClass);
      const first = await evening.run(orgs.demo.id);
      expect(first.absenceSummaries).toBe(1); // the ward was late → one summary to the guardian
      expect(first.notTaken).toBeGreaterThanOrEqual(1);
      const again = await evening.run(orgs.demo.id);
      expect(again.absenceSummaries).toBe(0);
      expect(again.notTaken).toBe(0);
      const staffInbox = await inbox(sheikh);
      expect(staffInbox.items.some((n: { type: string; entityId: string }) => n.type === 'SESSION_NOT_TAKEN' && n.entityId === late)).toBe(true);
      expect((await inbox(guardian)).items.filter((n: { type: string }) => n.type === 'ABSENCE_SUMMARY')).toHaveLength(1);
    });

    it('cancelling a session tells the families', async () => {
      const later = (
        await api(sheikh).post(`/courses/${courseId}/sessions`, { date: addDays(today(), 1), startTime: '16:00', endTime: '17:00' }).expect(201)
      ).body.id;
      await api(teacher).patch(`/sessions/${later}`, { status: 'CANCELLED' }).expect(200);
      await drain();
      expect((await inbox(guardian)).items.map((n: { type: string }) => n.type)).toContain('SCHEDULE_CHANGE');
    });
  });

  describe('event outbox (07-events-and-jobs §7)', () => {
    const scoped = () => prisma.$extends(organizationScopeExtension(orgs.demo.id));

    it('a domain write and its event commit together, or roll back together', async () => {
      const marker = randomUUID();
      await expect(
        scoped().$transaction(async (tx) => {
          await tx.excuseRequest.create({
            data: {
              organizationId: orgs.demo.id,
              memberId: wardMemberId,
              fromDate: new Date(),
              toDate: new Date(),
              reason: marker,
              submittedByIdentityId: guardian.identityId,
            },
          });
          await emit(tx, { organizationId: orgs.demo.id, requestId: marker, actorMembershipId: null }, {
            type: 'excuse.decided',
            aggregateType: 'excuse',
            aggregateId: randomUUID(),
            payload: {},
          });
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');
      expect(await prisma.excuseRequest.count({ where: { reason: marker } })).toBe(0);
      expect(await prisma.domainEvent.count({ where: { requestId: marker } })).toBe(0);

      // And an API write carries its request id onto the event (EV-06).
      const res = await http()
        .post(`/api/v1/sessions/${sessionId}/attendance`)
        .set('cookie', teacher.cookie)
        .set(teacher.csrfHeader, teacher.csrf)
        .set('x-request-id', marker)
        .send({ marks: [{ idempotencyKey: randomUUID(), enrollmentId: wardEnrollmentId, status: 'PRESENT' }] })
        .expect(200);
      const event = await prisma.domainEvent.findFirstOrThrow({ where: { aggregateId: res.body.results[0].entityId, requestId: marker } });
      expect(event.type).toBe('attendance.marked');
    });

    it('a re-dispatch or a second delivery doubles nothing (EV-03)', async () => {
      await api(teacher).post('/memorization/tests', {
        idempotencyKey: randomUUID(),
        memberId: wardMemberId,
        materialId: quranId,
        courseId,
        scopeType: 'JUZ',
        juz: 30,
        score: 90,
      }).expect(201);
      await outbox.dispatchOnce();
      const event = await prisma.domainEvent.findFirstOrThrow({ where: { organizationId: orgs.demo.id, type: 'test.recorded' } });
      // A crashed dispatcher that never marked the event re-runs it: the unique key absorbs it.
      await prisma.domainEvent.update({ where: { id: event.id }, data: { dispatchedAt: null } });
      await outbox.dispatchOnce();
      const deliveries = await prisma.eventDelivery.findMany({ where: { eventId: event.id } });
      expect(deliveries).toHaveLength(1);

      expect(await outbox.deliver(deliveries[0].id, false)).toBe('done');
      expect(await outbox.deliver(deliveries[0].id, false)).toBe('skipped');
      // Even forced back to PENDING, the handler's dedupe keys insert nothing new.
      const before = await prisma.notification.count({ where: { organizationId: orgs.demo.id } });
      await prisma.eventDelivery.update({ where: { id: deliveries[0].id }, data: { status: 'PENDING' } });
      await outbox.deliver(deliveries[0].id, false);
      expect(await prisma.notification.count({ where: { organizationId: orgs.demo.id } })).toBe(before);
      expect((await inbox(guardian)).items.map((n: { type: string }) => n.type)).toContain('TEST_RESULT');
    });

    it('a failing handler ends as a visible dead letter that staff can retry (EV-05)', async () => {
      const event = await prisma.domainEvent.create({
        data: {
          organizationId: orgs.demo.id,
          type: 'test.recorded',
          aggregateType: 'member',
          aggregateId: wardMemberId,
          payload: {},
          dispatchedAt: new Date(), // delivered by hand below, not by the dispatcher
        },
      });
      const delivery = await prisma.eventDelivery.create({ data: { eventId: event.id, handler: 'notify.missing' } });
      await expect(outbox.deliver(delivery.id, false)).rejects.toThrow('No handler');
      expect((await prisma.eventDelivery.findUniqueOrThrow({ where: { id: delivery.id } })).status).toBe('FAILED');
      await expect(outbox.deliver(delivery.id, true)).rejects.toThrow();
      expect((await prisma.eventDelivery.findUniqueOrThrow({ where: { id: delivery.id } })).status).toBe('DEAD');

      const failed = await api(sheikh).get('/events/failed').expect(200);
      expect(failed.body).toEqual([expect.objectContaining({ id: delivery.id, status: 'DEAD', attempts: 2 })]);
      await api(teacher).get('/events/failed').expect(403);
      await api(otherSheikh).post(`/events/deliveries/${delivery.id}/retry`).expect(404);
      await api(sheikh).post(`/events/deliveries/${delivery.id}/retry`).expect(204);
      expect((await prisma.eventDelivery.findUniqueOrThrow({ where: { id: delivery.id } })).status).toBe('PENDING');
      await prisma.eventDelivery.delete({ where: { id: delivery.id } });
    });

    it('two events for one aggregate converge whatever order they run in (EV-04)', async () => {
      const s3 = (
        await api(sheikh).post(`/courses/${courseId}/sessions`, { date: today(), startTime: '00:04', endTime: '00:05' }).expect(201)
      ).body.id;
      await mark(teacher, wardEnrollmentId, 'PRESENT', s3);
      await mark(sheikh, wardEnrollmentId, 'LATE', s3);
      await mark(teacher, wardEnrollmentId, 'PRESENT', s3);
      await outbox.dispatchOnce();
      const deliveries = await prisma.eventDelivery.findMany({
        where: { status: 'PENDING', event: { organizationId: orgs.demo.id, type: 'attendance.marked' } },
        orderBy: { createdAt: 'desc' },
      });
      for (const d of deliveries) await outbox.deliver(d.id, false); // newest first
      const overridden = await prisma.notification.findMany({
        where: { organizationId: orgs.demo.id, type: 'ATTENDANCE_OVERRIDDEN', entityId: s3 },
      });
      // The teacher was overridden by the sheikh, then the sheikh by the teacher: one each, in any order.
      expect(overridden).toHaveLength(2);
    });

    it("'end of day' is each organization's own (SH-01)", async () => {
      await prisma.organization.update({ where: { id: orgs.other.id }, data: { timezone: 'Pacific/Kiritimati' } });
      const now = new Date('2026-10-15T11:00:00Z');
      expect((await evening.run(orgs.demo.id, now)).date).toBe('2026-10-15');
      expect((await evening.run(orgs.other.id, now)).date).toBe('2026-10-16');
    });

    it('event payloads carry ids and facts, never names or phones (EV-07)', async () => {
      const events = await prisma.domainEvent.findMany({ where: { organizationId: orgs.demo.id } });
      expect(events.length).toBeGreaterThan(5);
      const people = await prisma.member.findMany({ where: { organizationId: orgs.demo.id } });
      const text = JSON.stringify(events.map((e) => e.payload));
      for (const p of people) {
        expect(text).not.toContain(p.firstName);
        if (p.phone) expect(text).not.toContain(p.phone);
      }
    });

    it('archiving a member closes enrollments and stops their login (WF-10)', async () => {
      await api(sheikh).post(`/members/${wardMemberId}/archive`).expect(201);
      await drain();
      const enrollment = await prisma.enrollment.findUniqueOrThrow({ where: { id: wardEnrollmentId } });
      expect(enrollment.status).toBe('WITHDRAWN');
      const membership = await prisma.membership.findFirstOrThrow({ where: { identityId: ward.identityId } });
      expect(membership.status).toBe('SUSPENDED');
      await api(ward).get('/schedule').expect(401);
    });
  });
});
