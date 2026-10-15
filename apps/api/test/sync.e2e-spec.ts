process.env.JOBS_WORKER = 'off';
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/api-exception.filter';
import { dateIn } from '../src/common/zoned-time';
import { rebuildSummaries } from '../scripts/rebuild-projections';
import {
  loginAs,
  removeAuthFixtures,
  type AuthenticatedSession,
} from './fixtures/auth-session';
import {
  removeTwoOrganizations,
  twoOrganizations,
  type TwoOrganizations,
} from './fixtures/organizations';

const prisma = new PrismaClient();
const TZ = 'Asia/Damascus';

type Mutation = {
  idempotencyKey: string;
  type: string;
  capturedAt: string;
  payload: object;
};

describe('Class mode and offline sync (S3, e2e)', () => {
  let app: INestApplication<App>;
  let orgs: TwoOrganizations;
  let sheikh: AuthenticatedSession;
  let otherSheikh: AuthenticatedSession;
  let teacher: AuthenticatedSession;
  let teacher2: AuthenticatedSession;
  let student: AuthenticatedSession;
  let teacherMemberId: string;
  let teacher2MemberId: string;
  const sessions: AuthenticatedSession[] = [];

  let quranId: string;
  let bookId: string;
  let courseId: string;
  let sessionId: string;
  const students: { memberId: string; enrollmentId: string }[] = [];

  const http = () => request(app.getHttpServer());
  const api = (s: AuthenticatedSession) => ({
    get: (path: string) => http().get(`/api/v1${path}`).set('cookie', s.cookie),
    post: (path: string, body: object = {}) =>
      http()
        .post(`/api/v1${path}`)
        .set('cookie', s.cookie)
        .set(s.csrfHeader, s.csrf)
        .send(body),
    patch: (path: string, body: object) =>
      http()
        .patch(`/api/v1${path}`)
        .set('cookie', s.cookie)
        .set(s.csrfHeader, s.csrf)
        .send(body),
    delete: (path: string) =>
      http()
        .delete(`/api/v1${path}`)
        .set('cookie', s.cookie)
        .set(s.csrfHeader, s.csrf),
  });
  const sync = (s: AuthenticatedSession, mutations: Mutation[]) =>
    api(s).post('/sync/mutations', { mutations });

  const now = () => new Date().toISOString();
  const mark = (
    enrollmentId: string,
    status: string,
    capturedAt = now(),
    sid = sessionId,
  ): Mutation => ({
    idempotencyKey: randomUUID(),
    type: 'attendance.mark',
    capturedAt,
    payload: { sessionId: sid, enrollmentId, status },
  });
  const recite = (
    memberId: string,
    range: number[],
    extra: object = {},
  ): Mutation => ({
    idempotencyKey: randomUUID(),
    type: 'memorization.log',
    capturedAt: now(),
    payload: {
      memberId,
      materialId: quranId,
      courseId,
      type: 'NEW',
      range: {
        surahStart: range[0],
        ayahStart: range[1],
        surahEnd: range[2],
        ayahEnd: range[3],
      },
      grade: 'GOOD',
      ...extra,
    },
  });

  async function memberIdOf(s: AuthenticatedSession) {
    return (
      await prisma.membership.findFirstOrThrow({
        where: { identityId: s.identityId },
      })
    ).memberId!;
  }

  async function newMember(firstName: string) {
    const res = await api(sheikh)
      .post('/members', {
        firstName,
        fatherName: 'Sync',
        familyName: 'Test',
        birthDate: '2014-03-01',
        joinedAt: '2026-09-01',
      })
      .expect(201);
    return res.body.id as string;
  }

  async function newCourse(body: object = {}) {
    const res = await api(sheikh)
      .post('/courses', { name: 'Asr halaqa', type: 'BOTH', ...body })
      .expect(201);
    const id = res.body.id as string;
    await api(sheikh)
      .post(`/courses/${id}/materials`, {
        materialId: quranId,
        track: 'MEMORIZATION',
      })
      .expect(201);
    if ((body as { type?: string }).type !== 'MEMORIZATION')
      await api(sheikh)
        .post(`/courses/${id}/materials`, {
          materialId: bookId,
          track: 'EXPLANATION',
        })
        .expect(201);
    return id;
  }

  async function todaySession(course: string) {
    const res = await api(sheikh)
      .post(`/courses/${course}/sessions`, {
        date: dateIn(new Date(), TZ),
        startTime: '00:01',
        endTime: '23:59',
      })
      .expect(201);
    return res.body.id as string;
  }

  async function enroll(course: string, memberId: string) {
    const res = await api(sheikh)
      .post(`/courses/${course}/enrollments`, { memberId })
      .expect(201);
    return res.body.enrollment.id as string;
  }

  beforeAll(async () => {
    orgs = await twoOrganizations(prisma, 'e2e-s3');
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication({ bufferLogs: true });
    app.useLogger(app.get(Logger));
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();

    sheikh = await loginAs(prisma, app, orgs.demo.id, 'SHEIKH');
    otherSheikh = await loginAs(prisma, app, orgs.other.id, 'SHEIKH');
    teacher = await loginAs(prisma, app, orgs.demo.id, 'MEMBER');
    teacher2 = await loginAs(prisma, app, orgs.demo.id, 'MEMBER');
    student = await loginAs(prisma, app, orgs.demo.id, 'MEMBER');
    sessions.push(sheikh, otherSheikh, teacher, teacher2, student);
    teacherMemberId = await memberIdOf(teacher);
    teacher2MemberId = await memberIdOf(teacher2);

    quranId = (
      await prisma.material.create({
        data: {
          organizationId: orgs.demo.id,
          kind: 'QURAN',
          title: 'Quran',
          totalPages: 604,
        },
      })
    ).id;
    bookId = (
      await api(sheikh)
        .post('/materials', {
          kind: 'BOOK',
          title: 'Riyad as-Salihin',
          totalPages: 300,
        })
        .expect(201)
    ).body.id;

    courseId = await newCourse();
    await api(sheikh)
      .patch(`/courses/${courseId}`, { isHierarchical: true })
      .expect(200);
    await api(sheikh)
      .post(`/courses/${courseId}/teachers`, { memberId: teacherMemberId })
      .expect(201);
    await api(sheikh)
      .post(`/courses/${courseId}/teachers`, { memberId: teacher2MemberId })
      .expect(201);
    await api(sheikh)
      .post(`/courses/${courseId}/status`, { status: 'ACTIVE' })
      .expect(201);
    for (const name of ['Ahmad', 'Bilal', 'Hamza']) {
      const memberId = await newMember(name);
      students.push({
        memberId,
        enrollmentId: await enroll(courseId, memberId),
      });
    }
    students.push({
      memberId: await memberIdOf(student),
      enrollmentId: await enroll(courseId, await memberIdOf(student)),
    });
    sessionId = await todaySession(courseId);
  });

  afterAll(async () => {
    await removeAuthFixtures(
      prisma,
      sessions.map((s) => s.identityId),
    );
    await removeTwoOrganizations(prisma, orgs);
    await app.close();
    await prisma.$disconnect();
  });

  describe('class kit (T308, SYNC-02)', () => {
    it("holds today's sessions, the roster, materials and positions", async () => {
      const res = await api(teacher).get('/class-kit').expect(200);
      expect(res.body.timezone).toBe(TZ);
      expect(res.body.date).toBe(dateIn(new Date(), TZ));
      const session = res.body.sessions.find(
        (s: { id: string }) => s.id === sessionId,
      );
      expect(session.roster).toHaveLength(4);
      expect(session.groupIds).toEqual([]);
      expect(
        res.body.materials.map((m: { kind: string }) => m.kind).sort(),
      ).toEqual(['BOOK', 'QURAN']);
    });

    it('is empty for someone who teaches nothing', async () => {
      const res = await api(student).get('/class-kit').expect(200);
      expect(res.body.sessions).toEqual([]);
    });
  });

  describe('sync endpoint (T312, SYNC-09…12)', () => {
    it('applies a mixed batch and answers a resent batch with duplicates only', async () => {
      const batch = [
        mark(students[0].enrollmentId, 'PRESENT'),
        recite(students[0].memberId, [78, 1, 78, 16]),
        {
          idempotencyKey: randomUUID(),
          type: 'material.log',
          capturedAt: now(),
          payload: {
            sessionId,
            materialId: bookId,
            pageFrom: 10,
            pageTo: 12,
            note: 'Chapter on sincerity',
          },
        },
      ];
      const first = await sync(teacher, batch).expect(200);
      expect(
        first.body.results.map((r: { status: string }) => r.status),
      ).toEqual(['applied', 'applied', 'applied']);

      const again = await sync(teacher, batch).expect(200);
      expect(
        again.body.results.map((r: { status: string }) => r.status),
      ).toEqual(['duplicate', 'duplicate', 'duplicate']);
      expect(
        again.body.results.map((r: { entityId: string }) => r.entityId),
      ).toEqual(
        first.body.results.map((r: { entityId: string }) => r.entityId),
      );
      expect(
        await prisma.memorizationLog.count({
          where: { memberId: students[0].memberId },
        }),
      ).toBe(1);
      expect(await prisma.materialLog.count({ where: { sessionId } })).toBe(1);

      const session = await prisma.courseSession.findUniqueOrThrow({
        where: { id: sessionId },
      });
      expect(session.status).toBe('HELD');

      const summary = await prisma.memorizationSummary.findFirstOrThrow({
        where: { memberId: students[0].memberId },
      });
      expect(summary).toMatchObject({
        ayahsMemorized: 16,
        lastSurah: 78,
        lastAyah: 16,
        lastPageReached: 582,
      });
    });

    it('two teachers offline on one student: the later markedAt wins and the loser is audited', async () => {
      const { enrollmentId } = students[1];
      const later = mark(
        enrollmentId,
        'LATE',
        new Date(Date.now() - 60_000).toISOString(),
      );
      const earlier = mark(
        enrollmentId,
        'ABSENT',
        new Date(Date.now() - 120_000).toISOString(),
      );

      expect(
        (await sync(teacher, [later]).expect(200)).body.results[0].status,
      ).toBe('applied');
      const lost = (await sync(teacher2, [earlier]).expect(200)).body
        .results[0];
      expect(lost.status).toBe('superseded');
      expect(lost.server).toMatchObject({
        status: 'LATE',
        markedByMemberId: teacherMemberId,
      });

      const rows = await prisma.attendance.findMany({
        where: { sessionId, enrollmentId },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('LATE');
      expect(
        await prisma.auditLog.count({
          where: { entityId: rows[0].id, action: 'attendance.superseded' },
        }),
      ).toBe(1);

      // A newer correction overwrites and counts the overwrite.
      await sync(teacher2, [mark(enrollmentId, 'PRESENT')]).expect(200);
      const updated = await prisma.attendance.findFirstOrThrow({
        where: { sessionId, enrollmentId },
      });
      expect(updated).toMatchObject({
        status: 'PRESENT',
        supersededCount: 1,
        markedByMemberId: teacher2MemberId,
      });
    });

    it('distrusts a device clock a day off: clamped and flagged', async () => {
      const yesterday = new Date(Date.now() - 26 * 3600_000).toISOString();
      const res = await sync(teacher, [
        mark(students[2].enrollmentId, 'PRESENT', yesterday),
      ]).expect(200);
      expect(res.body.results[0].status).toBe('applied');
      const row = await prisma.attendance.findUniqueOrThrow({
        where: { id: res.body.results[0].entityId },
      });
      expect(Math.abs(row.markedAt.getTime() - Date.now())).toBeLessThan(
        60_000,
      );
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { entityId: row.id, action: 'attendance.marked' },
      });
      expect(audit.after).toMatchObject({ clockSkew: true });
    });

    it('rejects one bad entry without failing the batch', async () => {
      const res = await sync(teacher, [
        recite(students[2].memberId, [1, 1, 1, 99]), // Al-Fatiha has 7 ayahs
        mark(students[3].enrollmentId, 'PRESENT'),
        mark(randomUUID(), 'PRESENT'),
      ]).expect(200);
      expect(res.body.results.map((r: { status: string }) => r.status)).toEqual(
        ['rejected', 'applied', 'rejected'],
      );
      expect(res.body.results[0].error.code).toBe('VALIDATION_ERROR');
      expect(res.body.results[2].error.code).toBe('NOT_FOUND');
    });

    it('refuses a batch over 200 whole', async () => {
      const many = Array.from({ length: 201 }, () =>
        mark(students[0].enrollmentId, 'PRESENT'),
      );
      await sync(teacher, many).expect(400);
    });

    it('authorises at replay time: a removed teacher is rejected, never applied (PERM-12)', async () => {
      const course = await newCourse();
      await api(sheikh)
        .patch(`/courses/${course}`, { isHierarchical: true })
        .expect(200);
      await api(sheikh)
        .post(`/courses/${course}/teachers`, { memberId: teacherMemberId })
        .expect(201);
      await api(sheikh)
        .post(`/courses/${course}/teachers`, { memberId: teacher2MemberId })
        .expect(201);
      await api(sheikh)
        .post(`/courses/${course}/status`, { status: 'ACTIVE' })
        .expect(201);
      const enrollmentId = await enroll(course, students[0].memberId);
      const sid = await todaySession(course);

      // Captured during class, replayed after the sheikh removed them.
      const queued = mark(enrollmentId, 'PRESENT', now(), sid);
      await api(sheikh)
        .delete(`/courses/${course}/teachers/${teacher2MemberId}`)
        .expect(200);
      const res = await sync(teacher2, [queued]).expect(200);
      expect(res.body.results[0]).toMatchObject({
        status: 'rejected',
        error: { code: 'FORBIDDEN' },
      });
      expect(await prisma.attendance.count({ where: { sessionId: sid } })).toBe(
        0,
      );
      expect(
        await prisma.syncMutation.count({
          where: { idempotencyKey: queued.idempotencyKey },
        }),
      ).toBe(0);
    });

    it('a member who teaches nothing cannot write (403 per mutation)', async () => {
      const res = await sync(student, [
        mark(students[0].enrollmentId, 'ABSENT'),
      ]).expect(200);
      expect(res.body.results[0]).toMatchObject({
        status: 'rejected',
        error: { code: 'FORBIDDEN' },
      });
    });

    it('needs a session; an expired one keeps the queue for a replay after sign-in (SYNC-15)', async () => {
      const queued = [mark(students[3].enrollmentId, 'LATE')];
      await http()
        .post('/api/v1/sync/mutations')
        .send({ mutations: queued })
        .expect(401);
      const res = await sync(teacher, queued).expect(200);
      expect(res.body.results[0].status).toBe('applied');
    });

    it('a 40-student class: kit under 150 KB, 200 mutations replayed in one request under 2 seconds', async () => {
      const course = await newCourse();
      await api(sheikh)
        .post(`/courses/${course}/teachers`, { memberId: teacherMemberId })
        .expect(201);
      await api(sheikh)
        .post(`/courses/${course}/status`, { status: 'ACTIVE' })
        .expect(201);
      const members = await prisma.member.createManyAndReturn({
        data: Array.from({ length: 40 }, (_, i) => ({
          organizationId: orgs.demo.id,
          firstName: `Student${i}`,
          fatherName: 'Budget',
          familyName: 'Class',
          birthDate: new Date('2013-01-01'),
          joinedAt: new Date('2026-09-01'),
        })),
      });
      const enrollments = await prisma.enrollment.createManyAndReturn({
        data: members.map((m) => ({
          organizationId: orgs.demo.id,
          courseId: course,
          memberId: m.id,
          startedAt: new Date('2026-09-01'),
        })),
      });
      const sid = await todaySession(course);

      const kit = await api(teacher).get('/class-kit').expect(200);
      expect(Buffer.byteLength(JSON.stringify(kit.body))).toBeLessThan(150_000);

      // One attendance mark and four recitations per student, as a full class would queue.
      const batch: Mutation[] = [];
      enrollments.forEach((e, i) => {
        batch.push(mark(e.id, 'PRESENT', now(), sid));
        for (let k = 0; k < 4; k++)
          batch.push({
            ...recite(e.memberId, [2, 10 * k + 1, 2, 10 * k + 10], {
              courseId: course,
            }),
            capturedAt: new Date(Date.now() - (i + k) * 1000).toISOString(),
          });
      });
      expect(batch).toHaveLength(200);

      const started = Date.now();
      const res = await sync(teacher, batch).expect(200);
      const elapsed = Date.now() - started;
      expect(
        res.body.results.every(
          (r: { status: string }) => r.status === 'applied',
        ),
      ).toBe(true);
      expect(elapsed).toBeLessThan(2000);
      const summary = await prisma.memorizationSummary.findFirstOrThrow({
        where: { memberId: members[0].id },
      });
      expect(summary.ayahsMemorized).toBe(40);
    });
  });

  describe('groups and tenancy (PERM-11, DM-02)', () => {
    it("a teacher reaches only their own group's students", async () => {
      const course = await newCourse();
      await api(sheikh)
        .patch(`/courses/${course}`, { isHierarchical: true, hasGroups: true })
        .expect(200);
      await api(sheikh)
        .post(`/courses/${course}/teachers`, { memberId: teacherMemberId })
        .expect(201);
      await api(sheikh)
        .post(`/courses/${course}/teachers`, { memberId: teacher2MemberId })
        .expect(201);
      await api(sheikh)
        .post(`/courses/${course}/status`, { status: 'ACTIVE' })
        .expect(201);
      const mine = await enroll(course, students[0].memberId);
      const theirs = await enroll(course, students[1].memberId);
      const a = await api(sheikh)
        .post(`/courses/${course}/groups`, { name: 'A', teacherMemberId })
        .expect(201);
      const b = await api(sheikh)
        .post(`/courses/${course}/groups`, {
          name: 'B',
          teacherMemberId: teacher2MemberId,
        })
        .expect(201);
      await api(sheikh)
        .post(`/courses/${course}/groups/${a.body.id}/students`, {
          enrollmentId: mine,
        })
        .expect(201);
      await api(sheikh)
        .post(`/courses/${course}/groups/${b.body.id}/students`, {
          enrollmentId: theirs,
        })
        .expect(201);
      const sid = await todaySession(course);

      const kit = await api(teacher).get('/class-kit').expect(200);
      const kitSession = kit.body.sessions.find(
        (s: { id: string }) => s.id === sid,
      );
      expect(
        kitSession.roster.map((r: { enrollmentId: string }) => r.enrollmentId),
      ).toEqual([mine]);
      expect(kitSession.groupIds).toEqual([a.body.id]);

      const roster = await api(teacher)
        .get(`/sessions/${sid}/attendance`)
        .expect(200);
      expect(roster.body.roster).toHaveLength(1);

      const res = await sync(teacher, [
        mark(mine, 'PRESENT', now(), sid),
        mark(theirs, 'PRESENT', now(), sid),
      ]).expect(200);
      expect(res.body.results.map((r: { status: string }) => r.status)).toEqual(
        ['applied', 'rejected'],
      );

      // Explanation pages need the group in a grouped course.
      const pages = {
        sessionId: sid,
        materialId: bookId,
        pageFrom: 1,
        pageTo: 2,
      };
      await api(teacher)
        .post('/material-logs', { ...pages, idempotencyKey: randomUUID() })
        .expect(400);
      await api(teacher)
        .post('/material-logs', {
          ...pages,
          groupId: b.body.id,
          idempotencyKey: randomUUID(),
        })
        .expect(403);
      await api(teacher)
        .post('/material-logs', {
          ...pages,
          groupId: a.body.id,
          idempotencyKey: randomUUID(),
        })
        .expect(201);
    });

    it('another mosque sees 404, never 403, and its replays find nothing', async () => {
      await api(otherSheikh)
        .get(`/sessions/${sessionId}/attendance`)
        .expect(404);
      await api(otherSheikh)
        .patch(`/sessions/${sessionId}`, { topic: 'x' })
        .expect(404);
      const res = await sync(otherSheikh, [
        mark(students[0].enrollmentId, 'ABSENT'),
      ]).expect(200);
      expect(res.body.results[0]).toMatchObject({
        status: 'rejected',
        error: { code: 'NOT_FOUND' },
      });
      const logs = await api(otherSheikh)
        .get(`/memorization/logs?memberId=${students[0].memberId}`)
        .expect(200);
      expect(logs.body).toEqual([]);
    });
  });

  describe('online endpoints (T301–T306)', () => {
    it('marks attendance in a batch with the offline rules', async () => {
      const res = await api(teacher)
        .post(`/sessions/${sessionId}/attendance`, {
          marks: [
            {
              idempotencyKey: randomUUID(),
              enrollmentId: students[2].enrollmentId,
              status: 'EXCUSED',
            },
          ],
        })
        .expect(200);
      expect(res.body.results[0].status).toBe('applied');
      const roster = await api(teacher)
        .get(`/sessions/${sessionId}/attendance`)
        .expect(200);
      const entry = roster.body.roster.find(
        (r: { enrollmentId: string }) =>
          r.enrollmentId === students[2].enrollmentId,
      );
      expect(entry.attendance.status).toBe('EXCUSED');
    });

    it('refuses to cancel a session with attendance; staff add extra sessions', async () => {
      await api(teacher)
        .patch(`/sessions/${sessionId}`, { status: 'CANCELLED' })
        .expect(409);
      const updated = await api(teacher)
        .patch(`/sessions/${sessionId}`, { topic: 'Surah An-Naba' })
        .expect(200);
      expect(updated.body.topic).toBe('Surah An-Naba');
      await api(student)
        .patch(`/sessions/${sessionId}`, { topic: 'x' })
        .expect(403);
    });

    it('logs a text by pages and refuses pages past its end', async () => {
      const course = await newCourse({ type: 'MEMORIZATION' });
      const matn = (
        await api(sheikh)
          .post('/materials', {
            kind: 'TEXT',
            title: 'Tuhfat al-Atfal',
            totalPages: 8,
          })
          .expect(201)
      ).body.id;
      await api(sheikh)
        .post(`/courses/${course}/materials`, {
          materialId: matn,
          track: 'MEMORIZATION',
        })
        .expect(201);
      await api(sheikh)
        .post(`/courses/${course}/teachers`, { memberId: teacherMemberId })
        .expect(201);
      await api(sheikh)
        .post(`/courses/${course}/status`, { status: 'ACTIVE' })
        .expect(201);
      await enroll(course, students[1].memberId);
      const base = {
        memberId: students[1].memberId,
        materialId: matn,
        courseId: course,
        type: 'NEW',
      };
      await api(teacher)
        .post('/memorization/logs', {
          ...base,
          pageFrom: 7,
          pageTo: 9,
          idempotencyKey: randomUUID(),
        })
        .expect(400);
      await api(teacher)
        .post('/memorization/logs', {
          ...base,
          pageFrom: 1,
          pageTo: 3,
          idempotencyKey: randomUUID(),
        })
        .expect(201);
      const summary = await prisma.memorizationSummary.findFirstOrThrow({
        where: { memberId: students[1].memberId, materialId: matn },
      });
      expect(summary.pagesMemorized).toBe(3);
    });

    it('voids a log with a reason, recomputes the summary, and refuses a second void (DM-08)', async () => {
      const logged = await sync(teacher, [
        recite(students[2].memberId, [79, 1, 79, 10]),
      ]).expect(200);
      const logId = logged.body.results[0].entityId;
      let summary = await prisma.memorizationSummary.findFirstOrThrow({
        where: { memberId: students[2].memberId },
      });
      expect(summary.ayahsMemorized).toBe(10);

      await api(teacher)
        .post(`/memorization/logs/${logId}/void`, {})
        .expect(400);
      await api(teacher2)
        .post(`/memorization/logs/${logId}/void`, { reason: 'Wrong student' })
        .expect(403);
      await api(teacher)
        .post(`/memorization/logs/${logId}/void`, { reason: 'Wrong student' })
        .expect(204);
      await api(sheikh)
        .post(`/memorization/logs/${logId}/void`, { reason: 'Again' })
        .expect(409);

      summary = await prisma.memorizationSummary.findFirstOrThrow({
        where: { memberId: students[2].memberId },
      });
      expect(summary.ayahsMemorized).toBe(0);
      const log = await prisma.memorizationLog.findUniqueOrThrow({
        where: { id: logId },
      });
      expect(log.voidReason).toBe('Wrong student');
    });

    it('keeps every test attempt and applies the pass mark (WF-07)', async () => {
      const base = {
        memberId: students[0].memberId,
        materialId: quranId,
        courseId,
        scopeType: 'JUZ',
        juz: 30,
      };
      const first = await api(teacher)
        .post('/memorization/tests', {
          ...base,
          score: 55,
          idempotencyKey: randomUUID(),
        })
        .expect(201);
      expect(first.body).toMatchObject({
        attemptNo: 1,
        passed: false,
        passMark: 60,
      });
      const key = randomUUID();
      const second = await api(teacher)
        .post('/memorization/tests', {
          ...base,
          score: 82,
          idempotencyKey: key,
        })
        .expect(201);
      expect(second.body).toMatchObject({ attemptNo: 2, passed: true });
      // A retried request returns the same attempt.
      const retry = await api(teacher)
        .post('/memorization/tests', {
          ...base,
          score: 82,
          idempotencyKey: key,
        })
        .expect(201);
      expect(retry.body.id).toBe(second.body.id);

      const list = await api(teacher)
        .get(
          `/memorization/tests?courseId=${courseId}&memberId=${students[0].memberId}`,
        )
        .expect(200);
      expect(list.body).toHaveLength(2);
      await api(teacher).get('/memorization/tests').expect(400); // a teacher names the course
    });

    it('only staff record a starting level', async () => {
      const initial = {
        memberId: students[3].memberId,
        materialId: quranId,
        courseId: null,
        type: 'INITIAL',
        range: { surahStart: 112, ayahStart: 1, surahEnd: 114, ayahEnd: 6 },
      };
      await api(teacher)
        .post('/memorization/logs', {
          ...initial,
          idempotencyKey: randomUUID(),
        })
        .expect(403);
      await api(sheikh)
        .post('/memorization/logs', {
          ...initial,
          idempotencyKey: randomUUID(),
        })
        .expect(201);
    });
  });

  describe('projection (ADR-0010)', () => {
    it('a rebuild from the ledger equals the incrementally maintained summaries', async () => {
      const incremental = await prisma.memorizationSummary.findMany({
        where: { organizationId: orgs.demo.id },
        orderBy: [{ memberId: 'asc' }, { materialId: 'asc' }],
      });
      expect(incremental.length).toBeGreaterThan(0);
      await rebuildSummaries(prisma, orgs.demo.id);
      const rebuilt = await prisma.memorizationSummary.findMany({
        where: { organizationId: orgs.demo.id },
        orderBy: [{ memberId: 'asc' }, { materialId: 'asc' }],
      });
      const strip = ({
        id: _id,
        updatedAt: _u,
        ...rest
      }: (typeof incremental)[number]) => rest;
      expect(rebuilt.map(strip)).toEqual(incremental.map(strip));
    });
  });
});
