process.env.JOBS_WORKER = 'off';
import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/api-exception.filter';
import { addDays, dateIn } from '../src/common/zoned-time';
import { SessionGeneratorService } from '../src/courses/session-generator.service';
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
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

describe('Courses and scheduling (S2, e2e)', () => {
  let app: INestApplication<App>;
  let orgs: TwoOrganizations;
  let sheikh: AuthenticatedSession;
  let otherSheikh: AuthenticatedSession;
  let teacher: AuthenticatedSession;
  let teacherMemberId: string;
  const sessions: AuthenticatedSession[] = [];

  const api = (session: AuthenticatedSession) => ({
    get: (path: string) =>
      request(app.getHttpServer())
        .get(`/api/v1${path}`)
        .set('cookie', session.cookie),
    post: (path: string, body: object = {}) =>
      request(app.getHttpServer())
        .post(`/api/v1${path}`)
        .set('cookie', session.cookie)
        .set(session.csrfHeader, session.csrf)
        .send(body),
    patch: (path: string, body: object) =>
      request(app.getHttpServer())
        .patch(`/api/v1${path}`)
        .set('cookie', session.cookie)
        .set(session.csrfHeader, session.csrf)
        .send(body),
    put: (path: string, body: object) =>
      request(app.getHttpServer())
        .put(`/api/v1${path}`)
        .set('cookie', session.cookie)
        .set(session.csrfHeader, session.csrf)
        .send(body),
    delete: (path: string) =>
      request(app.getHttpServer())
        .delete(`/api/v1${path}`)
        .set('cookie', session.cookie)
        .set(session.csrfHeader, session.csrf),
  });

  async function memberIdOf(session: AuthenticatedSession): Promise<string> {
    const row = await prisma.membership.findFirstOrThrow({
      where: { identityId: session.identityId },
    });
    return row.memberId!;
  }

  async function createMember(
    birthDate = '2016-05-10',
    firstName = 'Student',
  ): Promise<string> {
    const res = await api(sheikh)
      .post('/members', {
        firstName,
        fatherName: 'Test',
        familyName: 'Course',
        birthDate,
        joinedAt: '2026-09-01',
      })
      .expect(201);
    return res.body.id;
  }

  async function createCourse(body: object = {}): Promise<string> {
    const res = await api(sheikh)
      .post('/courses', { name: 'Fajr halaqa', type: 'MEMORIZATION', ...body })
      .expect(201);
    expect(res.body.status).toBe('DRAFT');
    return res.body.id;
  }

  async function quranId(): Promise<string> {
    const quran = await prisma.material.upsert({
      where: { id: '00000000-0000-4000-8000-0000000000a1' },
      update: {},
      create: {
        id: '00000000-0000-4000-8000-0000000000a1',
        organizationId: orgs.demo.id,
        kind: 'QURAN',
        title: 'Quran',
        totalPages: 604,
      },
    });
    return quran.id;
  }

  beforeAll(async () => {
    orgs = await twoOrganizations(prisma, 'e2e-s2');
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
    teacherMemberId = await memberIdOf(teacher);
    sessions.push(sheikh, otherSheikh, teacher);
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

  describe('materials (T201, OQ-3)', () => {
    it('staff create catalogue materials; members cannot', async () => {
      const res = await api(sheikh)
        .post('/materials', {
          kind: 'TEXT',
          title: 'Matn al-Jazariyya',
          totalPages: 12,
        })
        .expect(201);
      expect(res.body.kind).toBe('TEXT');
      await api(teacher)
        .post('/materials', { kind: 'BOOK', title: 'Nope' })
        .expect(403);
      const list = await api(teacher).get('/materials').expect(200);
      expect(list.body.map((m: { id: string }) => m.id)).toContain(res.body.id);
    });

    it('nobody can create a second Quran', async () => {
      await api(sheikh)
        .post('/materials', { kind: 'QURAN', title: 'Another' })
        .expect(400);
    });
  });

  describe('course lifecycle (T202, OQ-1)', () => {
    it('follows draft → active → finished, then is read-only', async () => {
      const id = await createCourse();
      await api(sheikh)
        .post(`/courses/${id}/status`, { status: 'FINISHED' })
        .expect(409);
      await api(sheikh)
        .post(`/courses/${id}/status`, { status: 'ACTIVE' })
        .expect(201);
      await api(sheikh)
        .patch(`/courses/${id}`, { location: 'Main hall' })
        .expect(200);
      await api(sheikh)
        .post(`/courses/${id}/status`, { status: 'FINISHED' })
        .expect(201);
      const blocked = await api(sheikh)
        .patch(`/courses/${id}`, { location: 'Upstairs' })
        .expect(409);
      expect(blocked.body.error.code).toBe('CONFLICT');
      await api(sheikh)
        .post(`/courses/${id}/status`, { status: 'ARCHIVED' })
        .expect(201);
      const list = await api(sheikh).get('/courses').expect(200);
      expect(list.body.map((c: { id: string }) => c.id)).not.toContain(id);
    });

    it('another organization gets 404, a member gets 403 (DM-02)', async () => {
      const id = await createCourse();
      await api(otherSheikh).get(`/courses/${id}`).expect(404);
      await api(otherSheikh).get(`/courses/${id}/sessions`).expect(404);
      await api(otherSheikh)
        .post(`/courses/${id}/status`, { status: 'ACTIVE' })
        .expect(404);
      await api(teacher).get(`/courses/${id}`).expect(403);
      await api(teacher).get('/courses').expect(403);
    });

    it('rejects a material on the wrong track', async () => {
      const id = await createCourse({ type: 'EXPLANATION' });
      const res = await api(sheikh)
        .post(`/courses/${id}/materials`, {
          materialId: await quranId(),
          track: 'MEMORIZATION',
        })
        .expect(400);
      expect(res.body.error.details.track).toBeDefined();
    });
  });

  describe('teachers and toggles (T205, DM-07, OQ-3)', () => {
    it('a teacher can add materials to their own course only, and cannot enroll', async () => {
      const mine = await createCourse({ type: 'BOTH' });
      const other = await createCourse({ type: 'BOTH' });
      const assigned = await api(sheikh)
        .post(`/courses/${mine}/teachers`, { memberId: teacherMemberId })
        .expect(201);
      expect(assigned.body[0].role).toBe('LEAD');

      await api(teacher)
        .post(`/courses/${mine}/materials`, {
          newMaterial: { kind: 'BOOK', title: 'Riyad as-Salihin' },
          track: 'EXPLANATION',
        })
        .expect(201);
      await api(teacher)
        .post(`/courses/${other}/materials`, {
          newMaterial: { kind: 'BOOK', title: 'Not mine' },
          track: 'EXPLANATION',
        })
        .expect(403);
      await api(teacher).get(`/courses/${mine}/materials`).expect(200);
      await api(teacher)
        .post(`/courses/${mine}/enrollments`, { memberId: teacherMemberId })
        .expect(403);

      const myCourses = await api(teacher).get('/me/courses').expect(200);
      expect(myCourses.body.map((c: { id: string }) => c.id)).toEqual([mine]);
      expect(myCourses.body[0].teachingRole).toBe('LEAD');

      const book = await prisma.material.findFirstOrThrow({
        where: { title: 'Riyad as-Salihin' },
      });
      await api(teacher)
        .patch(`/materials/${book.id}`, { author: 'An-Nawawi' })
        .expect(200);
    });

    it('needs the hierarchical toggle for a second teacher and for groups', async () => {
      const id = await createCourse();
      const second = await createMember('1990-01-01', 'Second');
      await api(sheikh)
        .post(`/courses/${id}/teachers`, { memberId: teacherMemberId })
        .expect(201);
      await api(sheikh)
        .post(`/courses/${id}/teachers`, { memberId: second })
        .expect(409);
      await api(sheikh)
        .patch(`/courses/${id}`, { hasGroups: true })
        .expect(409);
      await api(sheikh)
        .patch(`/courses/${id}`, { isHierarchical: true })
        .expect(200);
      const both = await api(sheikh)
        .post(`/courses/${id}/teachers`, { memberId: second })
        .expect(201);
      expect(
        both.body.filter((t: { endedAt: null }) => t.endedAt === null),
      ).toHaveLength(2);
      await api(sheikh)
        .patch(`/courses/${id}`, { isHierarchical: false })
        .expect(409);
      await api(sheikh)
        .delete(`/courses/${id}/teachers/${teacherMemberId}`)
        .expect(409); // the lead
      await api(sheikh).delete(`/courses/${id}/teachers/${second}`).expect(200);
    });
  });

  describe('enrollment (T203, T204)', () => {
    it('warns but never blocks (decision 4.1)', async () => {
      const id = await createCourse({ minAge: 12, capacity: 1 });
      await api(sheikh)
        .post(`/courses/${id}/requirements`, {
          type: 'MANUAL',
          description: 'Interview',
        })
        .expect(201);
      const young = await createMember('2016-05-10', 'Young');
      const res = await api(sheikh)
        .post(`/courses/${id}/enrollments`, { memberId: young })
        .expect(201);
      expect(
        res.body.warnings.map((w: { code: string }) => w.code).sort(),
      ).toEqual(['MANUAL', 'MIN_AGE']);

      const second = await createMember('2010-01-01', 'Older');
      const full = await api(sheikh)
        .post(`/courses/${id}/enrollments`, { memberId: second })
        .expect(201);
      expect(full.body.warnings.map((w: { code: string }) => w.code)).toContain(
        'CAPACITY',
      );

      await api(sheikh)
        .delete(`/courses/${id}/enrollments/${res.body.enrollment.id}`)
        .expect(204);
      const list = await api(sheikh)
        .get(`/courses/${id}/enrollments`)
        .expect(200);
      expect(
        list.body.find((e: { id: string }) => e.id === res.body.enrollment.id)
          .status,
      ).toBe('WITHDRAWN');
    });
  });

  describe('groups (T206, DM-06)', () => {
    it('allows one teacher per material per student, enforced by the database', async () => {
      const id = await createCourse({ type: 'BOTH' });
      await api(sheikh)
        .patch(`/courses/${id}`, { isHierarchical: true, hasGroups: true })
        .expect(200);
      const quran = await quranId();
      await api(sheikh)
        .post(`/courses/${id}/materials`, {
          materialId: quran,
          track: 'MEMORIZATION',
        })
        .expect(201);
      const second = await createMember('1990-01-01', 'Teacher2');
      await api(sheikh)
        .post(`/courses/${id}/teachers`, { memberId: teacherMemberId })
        .expect(201);
      await api(sheikh)
        .post(`/courses/${id}/teachers`, { memberId: second })
        .expect(201);

      const a = await api(sheikh)
        .post(`/courses/${id}/groups`, {
          name: 'A',
          teacherMemberId,
          materialId: quran,
        })
        .expect(201);
      const b = await api(sheikh)
        .post(`/courses/${id}/groups`, {
          name: 'B',
          teacherMemberId: second,
          materialId: quran,
        })
        .expect(201);
      const all = await api(sheikh)
        .post(`/courses/${id}/groups`, {
          name: 'Everything',
          teacherMemberId: second,
        })
        .expect(201);

      const student = await createMember();
      const enrolled = await api(sheikh)
        .post(`/courses/${id}/enrollments`, { memberId: student })
        .expect(201);
      const enrollmentId = enrolled.body.enrollment.id;

      await api(sheikh)
        .post(`/courses/${id}/groups/${a.body.id}/students`, { enrollmentId })
        .expect(201);
      await api(sheikh)
        .post(`/courses/${id}/groups/${b.body.id}/students`, { enrollmentId })
        .expect(409);
      await api(sheikh)
        .post(`/courses/${id}/groups/${all.body.id}/students`, { enrollmentId })
        .expect(409);

      // Bypass the API: the composite key + unique index still refuse a second Quran teacher.
      await expect(
        prisma.groupMember.create({
          data: {
            organizationId: orgs.demo.id,
            groupId: b.body.id,
            materialKey: quran,
            enrollmentId,
          },
        }),
      ).rejects.toThrow();
      // And a row cannot claim a material its group does not teach.
      await expect(
        prisma.groupMember.create({
          data: {
            organizationId: orgs.demo.id,
            groupId: all.body.id,
            materialKey: quran,
            enrollmentId,
          },
        }),
      ).rejects.toThrow();

      await api(sheikh)
        .patch(`/courses/${id}`, { hasGroups: false })
        .expect(409);
    });
  });

  describe('schedule and sessions (T207–T209, T211)', () => {
    it('generates four weeks ahead, idempotently, and honours pauses and status', async () => {
      const id = await createCourse();
      await api(sheikh)
        .put(`/courses/${id}/schedule`, {
          rules: EVERY_DAY.map((weekday) => ({
            weekday,
            start: { anchor: 'FIXED', time: '23:00' },
            end: { anchor: 'FIXED', time: '23:50' },
          })),
        })
        .expect(200);
      const generator = app.get(SessionGeneratorService);

      // Draft courses have no sessions.
      expect((await generator.reconcileCourse(orgs.demo.id, id)).created).toBe(
        0,
      );

      await api(sheikh)
        .post(`/courses/${id}/status`, { status: 'ACTIVE' })
        .expect(201);
      // A running worker may consume the enqueued job first, so assert on state, not on counts per call.
      const count = () =>
        prisma.courseSession.count({
          where: { courseId: id, startsAt: { gt: new Date() } },
        });
      await generator.reconcileCourse(orgs.demo.id, id);
      const generated = await count();
      expect(generated).toBeGreaterThanOrEqual(27);
      expect((await generator.reconcileCourse(orgs.demo.id, id)).created).toBe(
        0,
      );
      expect(await count()).toBe(generated);

      const today = dateIn(new Date(), 'Asia/Damascus');
      const pause = { fromDate: addDays(today, 3), toDate: addDays(today, 9) };
      await api(sheikh)
        .post(`/courses/${id}/pauses`, { ...pause, reason: 'Eid' })
        .expect(201);
      await generator.reconcileCourse(orgs.demo.id, id);
      expect(await count()).toBe(generated - 7);
      const listed = await api(sheikh)
        .get(`/courses/${id}/sessions`)
        .expect(200);
      expect(
        listed.body.some(
          (s: { date: string }) =>
            s.date >= pause.fromDate && s.date <= pause.toDate,
        ),
      ).toBe(false);

      await api(sheikh)
        .post(`/courses/${id}/status`, { status: 'PAUSED' })
        .expect(201);
      await generator.reconcileCourse(orgs.demo.id, id);
      const paused = await api(sheikh)
        .get(`/courses/${id}/sessions?from=${addDays(today, 1)}`)
        .expect(200);
      expect(paused.body).toHaveLength(0);
    });

    it('resolves prayer anchors and rejects a fixed end before its start', async () => {
      const id = await createCourse();
      await api(sheikh)
        .put(`/courses/${id}/schedule`, {
          rules: [
            {
              weekday: 0,
              start: { anchor: 'FIXED', time: '18:00' },
              end: { anchor: 'FIXED', time: '17:00' },
            },
          ],
        })
        .expect(400);
      const saved = await api(sheikh)
        .put(`/courses/${id}/schedule`, {
          rules: [
            {
              weekday: 0,
              start: { anchor: 'PRAYER', prayer: 'ASR', offsetMin: 10 },
              end: { anchor: 'FIXED', time: '22:00' },
            },
          ],
        })
        .expect(200);
      expect(saved.body[0].start).toEqual({
        anchor: 'PRAYER',
        prayer: 'ASR',
        offsetMin: 10,
      });
      // Replacing keeps one active rule set.
      const replaced = await api(sheikh)
        .put(`/courses/${id}/schedule`, { rules: [] })
        .expect(200);
      expect(replaced.body).toEqual([]);
    });
  });

  describe('prayer times (OQ-9)', () => {
    it("returns the org's own times with offsets", async () => {
      const res = await api(teacher)
        .get('/organization/prayer-times?date=2026-10-08')
        .expect(200);
      expect(res.body.timezone).toBe('Asia/Damascus');
      expect(res.body.times.maghrib).toMatch(/^\d\d:\d\d$/);
    });

    it('looks a city up (external calls stubbed) for staff only', async () => {
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockImplementation(async (input) => {
          const url = String(input);
          const body = url.includes('nominatim')
            ? [{ lat: '33.5131', lon: '36.3096', display_name: 'دمشق, سوريا' }]
            : {
                data: {
                  timings: {
                    Fajr: '05:11',
                    Sunrise: '06:34',
                    Dhuhr: '12:22',
                    Asr: '15:41',
                    Maghrib: '18:10 (EEST)',
                    Isha: '19:28',
                  },
                  date: { gregorian: { date: '08-10-2026' } },
                meta: { timezone: 'Asia/Damascus' },
                },
              };
          return new Response(JSON.stringify(body), { status: 200 });
        });
      try {
        const res = await api(sheikh)
          .get('/prayer-times/lookup?city=Damascus&country=Syria')
          .expect(200);
        expect(res.body.reference.maghrib).toBe('18:10');
        // Ribat's own times are computed for the same day Aladhan answered for.
        expect(res.body.date).toBe('2026-10-08');
        expect(res.body.computed.maghrib).toBe('18:10');
        expect(res.body.timezone).toBe('Asia/Damascus');
        expect(res.body.computed.fajr).toMatch(/^\d\d:\d\d$/);
        await api(teacher)
          .get('/prayer-times/lookup?city=Damascus')
          .expect(403);
        // Setup lookup closes once an organization exists.
        await request(app.getHttpServer())
          .get('/api/v1/setup/prayer-times/lookup?city=Damascus')
          .expect(409);
      } finally {
        fetchSpy.mockRestore();
      }
    });
  });
});
