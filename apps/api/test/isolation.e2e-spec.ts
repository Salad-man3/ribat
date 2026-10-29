process.env.JOBS_WORKER = 'off';
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { createPrismaClient } from '../src/prisma/create-prisma-client.js';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/api-exception.filter';
import { dateIn } from '../src/common/zoned-time';
import { drainCapturedLogs } from '../src/logging/logging.module';
import { loginAs, removeAuthFixtures, type AuthenticatedSession } from './fixtures/auth-session';
import { removeTwoOrganizations, twoOrganizations, type TwoOrganizations } from './fixtures/organizations';

const prisma = createPrismaClient();
const PHONE = '+963933123456';

/**
 * 10-testing-strategy §2: for every tenant-owned route, a member of another mosque gets 404,
 * never 403 (DM-02). A missing case here is a leak, not missing coverage.
 */
describe('Tenant isolation, PII in logs and page budgets (T502, T503, T505)', () => {
  let app: INestApplication<App>;
  let orgs: TwoOrganizations;
  let sheikh: AuthenticatedSession;
  let other: AuthenticatedSession;
  const ids: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const as = (s: AuthenticatedSession) => ({
    get: (path: string) => http().get(`/api/v1${path}`).set('cookie', s.cookie),
    send: (method: 'post' | 'patch' | 'put' | 'delete', path: string, body: object = {}) =>
      http()[method](`/api/v1${path}`).set('cookie', s.cookie).set(s.csrfHeader, s.csrf).send(body),
  });

  beforeAll(async () => {
    orgs = await twoOrganizations(prisma, 'e2e-iso');
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication({ bufferLogs: true });
    app.useLogger(app.get(Logger));
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    sheikh = await loginAs(prisma, app, orgs.demo.id, 'SHEIKH');
    other = await loginAs(prisma, app, orgs.other.id, 'SHEIKH');
    const a = as(sheikh);

    ids.member = (
      await a
        .send('post', '/members', { firstName: 'Iso', fatherName: 'Late', familyName: 'Test', birthDate: '2012-02-02', joinedAt: '2026-09-01', phone: PHONE })
        .expect(201)
    ).body.id;
    const quran = await prisma.material.create({
      data: { organizationId: orgs.demo.id, kind: 'QURAN', title: 'Quran', totalPages: 604 },
    });
    ids.material = quran.id;
    ids.course = (await a.send('post', '/courses', { name: 'Iso course', type: 'MEMORIZATION' }).expect(201)).body.id;
    await a.send('post', `/courses/${ids.course}/materials`, { materialId: quran.id, track: 'MEMORIZATION' }).expect(201);
    const sheikhMember = (await prisma.membership.findFirstOrThrow({ where: { identityId: sheikh.identityId } })).memberId!;
    await a.send('post', `/courses/${ids.course}/teachers`, { memberId: sheikhMember }).expect(201);
    await a.send('post', `/courses/${ids.course}/status`, { status: 'ACTIVE' }).expect(201);
    ids.enrollment = (await a.send('post', `/courses/${ids.course}/enrollments`, { memberId: ids.member }).expect(201)).body.enrollment.id;
    ids.session = (
      await a
        .send('post', `/courses/${ids.course}/sessions`, { date: dateIn(new Date(), 'Asia/Damascus'), startTime: '00:01', endTime: '23:59' })
        .expect(201)
    ).body.id;
    const logged = await a
      .send('post', '/memorization/logs', {
        idempotencyKey: randomUUID(),
        memberId: ids.member,
        materialId: quran.id,
        courseId: ids.course,
        type: 'NEW',
        range: { surahStart: 114, ayahStart: 1, surahEnd: 114, ayahEnd: 6 },
      })
      .expect(201);
    ids.log = logged.body.entityId;
    const hw = await a
      .send('post', '/homework', { courseId: ids.course, targetType: 'COURSE', title: 'Iso homework', dueDate: '2026-12-01' })
      .expect(201);
    ids.homework = hw.body.id;
    ids.task = (await a.get(`/homework/${hw.body.id}/tasks`).expect(200)).body[0].id;
    ids.excuse = (
      await a.send('post', '/excuses', { memberId: ids.member, fromDate: '2026-12-01', toDate: '2026-12-01', reason: 'Iso excuse' }).expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await removeAuthFixtures(prisma, [sheikh.identityId, other.identityId]);
    await removeTwoOrganizations(prisma, orgs);
    await app.close();
    await prisma.$disconnect();
  });

  const reads = () => [
    `/members/${ids.member}`,
    `/members/${ids.member}/guardians`,
    `/members/${ids.member}/notes`,
    `/members/${ids.member}/progress`,
    `/courses/${ids.course}`,
    `/courses/${ids.course}/materials`,
    `/courses/${ids.course}/teachers`,
    `/courses/${ids.course}/enrollments`,
    `/courses/${ids.course}/requirements`,
    `/courses/${ids.course}/groups`,
    `/courses/${ids.course}/schedule`,
    `/courses/${ids.course}/pauses`,
    `/courses/${ids.course}/sessions`,
    `/sessions/${ids.session}/attendance`,
    `/homework?courseId=${ids.course}`,
    `/homework/${ids.homework}/tasks`,
    `/material-logs?courseId=${ids.course}`,
    `/memorization/logs?courseId=${ids.course}`,
    `/memorization/tests?courseId=${ids.course}`,
  ];

  it('every tenant read answers 404 to another mosque, and 200 to its own', async () => {
    for (const path of reads()) {
      const theirs = await as(other).get(path);
      expect({ path, status: theirs.status }).toEqual({ path, status: 404 });
      const ours = await as(sheikh).get(path);
      expect({ path, status: ours.status }).toEqual({ path, status: 200 });
    }
  });

  it('every tenant write answers 404 to another mosque and changes nothing', async () => {
    const writes: [method: 'post' | 'patch' | 'put' | 'delete', path: string, body: object][] = [
      ['patch', `/members/${ids.member}`, { firstName: 'Hijacked' }],
      ['post', `/members/${ids.member}/archive`, {}],
      ['patch', `/courses/${ids.course}`, { name: 'Hijacked' }],
      ['post', `/courses/${ids.course}/status`, { status: 'PAUSED' }],
      ['post', `/courses/${ids.course}/enrollments`, { memberId: ids.member }],
      ['put', `/courses/${ids.course}/schedule`, { rules: [] }],
      ['patch', `/sessions/${ids.session}`, { topic: 'Hijacked' }],
      ['post', `/sessions/${ids.session}/attendance`, { marks: [{ idempotencyKey: randomUUID(), enrollmentId: ids.enrollment, status: 'ABSENT' }] }],
      ['post', `/memorization/logs/${ids.log}/void`, { reason: 'Hijacked' }],
      ['patch', `/homework/tasks/${ids.task}`, { status: 'DONE' }],
      ['post', `/excuses/${ids.excuse}/decision`, { decision: 'ACCEPTED' }],
      ['post', '/excuses', { memberId: ids.member, fromDate: '2026-12-02', toDate: '2026-12-02', reason: 'Hijacked' }],
    ];
    for (const [method, path, body] of writes) {
      const res = await as(other).send(method, path, body);
      expect({ path, status: res.status }).toEqual({ path, status: 404 });
    }
    const member = await prisma.member.findUniqueOrThrow({ where: { id: ids.member } });
    expect(member).toMatchObject({ firstName: 'Iso', status: 'ACTIVE' });
    expect(await prisma.attendance.count({ where: { sessionId: ids.session } })).toBe(0);
  });

  it('lists scoped by the session never show the other mosque', async () => {
    expect((await as(other).get('/excuses').expect(200)).body).toEqual([]);
    expect((await as(other).get(`/memorization/logs?memberId=${ids.member}`).expect(200)).body).toEqual([]);
    expect((await as(other).get('/members').expect(200)).body.map((m: { id: string }) => m.id)).not.toContain(ids.member);
  });

  it('request logs carry ids, never phone numbers, names or bodies (NFR-08)', async () => {
    drainCapturedLogs();
    await as(sheikh).get(`/members?search=${encodeURIComponent(PHONE)}`).expect(200);
    await as(sheikh).send('patch', `/members/${ids.member}`, { notes: 'Iso private note' }).expect(200);
    await http().post('/api/v1/auth/login').send({ phone: PHONE, password: 'wrong-password' });
    const text = JSON.stringify(drainCapturedLogs());
    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toContain(PHONE);
    expect(text).not.toContain('963933123456');
    expect(text).not.toContain('Iso private note');
    expect(text).not.toContain('wrong-password');
  });

  it('common pages answer within budget (01-architecture §11)', async () => {
    for (const path of ['/auth/me', '/schedule', `/members/${ids.member}/progress`, '/notifications', '/class-kit', `/courses/${ids.course}`]) {
      const started = Date.now();
      await as(sheikh).get(path).expect(200);
      expect({ path, ms: Date.now() - started < 300 }).toEqual({ path, ms: true });
    }
  });
});
