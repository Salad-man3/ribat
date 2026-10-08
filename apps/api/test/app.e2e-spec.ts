import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/api-exception.filter';
import { drainCapturedLogs } from '../src/logging/logging.module';
import { hashSecret } from '../src/auth/credentials';
import { CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE } from '../src/auth/session-cookie';
import {
  loginAs,
  removeAuthFixtures,
  type AuthenticatedSession,
} from './fixtures/auth-session';
import { removeTwoOrganizations, twoOrganizations } from './fixtures/organizations';

const E2E_CSRF_PHONE = '+963944000107';
const E2E_CSRF_PASSWORD = 'longenough';

function parseSetCookies(setCookie: string[] | string | undefined): Record<string, string> {
  const lines = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const out: Record<string, string> = {};
  for (const line of lines) {
    const [pair] = line.split(';');
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    out[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
  return out;
}

function browserCookieHeader(setCookie: string[] | string | undefined): string {
  return Object.entries(parseSetCookies(setCookie))
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

const prisma = new PrismaClient();

const validMember = {
  firstName: 'Ahmad',
  fatherName: 'Hassan',
  familyName: 'Ali',
  birthDate: '2015-03-01',
  joinedAt: '2024-09-01',
};

const KNOWN_ID = '11111111-1111-4111-8111-111111111111';
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CapturedLog = {
  requestId?: string;
  msg?: string;
  req?: { id?: string; method?: string; path?: string };
  res?: { statusCode?: number };
};

function isCapturedLog(value: unknown): value is CapturedLog {
  return typeof value === 'object' && value !== null;
}

function findRequestLog(lines: unknown[], requestId: string): CapturedLog | undefined {
  return lines.find(
    (line): line is CapturedLog => isCapturedLog(line) && line.requestId === requestId,
  );
}

describe('API (e2e)', () => {
  let app: INestApplication<App>;
  let demoOrgId: string;
  let otherOrgId: string;
  let orgs: Awaited<ReturnType<typeof twoOrganizations>>;

  beforeAll(async () => {
    orgs = await twoOrganizations(prisma);
    demoOrgId = orgs.demo.id;
    otherOrgId = orgs.other.id;
  });

  afterAll(async () => {
    await removeTwoOrganizations(prisma, orgs);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ bufferLogs: true });
    app.useLogger(app.get(Logger));
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Health', () => {
    it('GET /api/v1/health/live', () => {
      return request(app.getHttpServer()).get('/api/v1/health/live').expect(200).expect({ status: 'ok' });
    });
  });

  describe('Request logging', () => {
    it('echoes a valid x-request-id on the response and the log line', async () => {
      drainCapturedLogs();

      const response = await request(app.getHttpServer())
        .get('/api/v1/health/live?phone=0500000000')
        .set('x-request-id', KNOWN_ID)
        .set('cookie', 'session=super-secret-cookie-value')
        .set('authorization', 'Bearer super-secret-token-value')
        .expect(200);

      expect(response.headers['x-request-id']).toBe(KNOWN_ID);

      const log = findRequestLog(drainCapturedLogs(), KNOWN_ID);
      expect(log).toMatchObject({
        requestId: KNOWN_ID,
        msg: 'request completed',
        req: { id: KNOWN_ID, method: 'GET', path: '/api/v1/health/live' },
        res: { statusCode: 200 },
      });

      const serialized = JSON.stringify(log);
      expect(serialized).not.toContain('0500000000');
      expect(serialized).not.toContain('super-secret-cookie-value');
      expect(serialized).not.toContain('super-secret-token-value');
    });

    it('generates an id when the header is missing', async () => {
      drainCapturedLogs();

      const response = await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
      const requestId = response.headers['x-request-id'];

      expect(requestId).toMatch(UUID);
      expect(findRequestLog(drainCapturedLogs(), requestId)).toMatchObject({
        requestId,
        req: { id: requestId, path: '/api/v1/health/live' },
      });
    });

    it('replaces an invalid x-request-id', async () => {
      drainCapturedLogs();

      const response = await request(app.getHttpServer())
        .get('/api/v1/health/live')
        .set('x-request-id', 'not-a-uuid')
        .expect(200);

      const requestId = response.headers['x-request-id'];
      expect(requestId).toMatch(UUID);
      expect(requestId).not.toBe('not-a-uuid');

      const lines = drainCapturedLogs();
      expect(JSON.stringify(lines)).not.toContain('not-a-uuid');
      expect(findRequestLog(lines, requestId)?.req?.id).toBe(requestId);
    });

    it('puts the same id on a 404 error body', async () => {
      drainCapturedLogs();

      const response = await request(app.getHttpServer())
        .get('/api/v1/does-not-exist')
        .set('x-request-id', KNOWN_ID)
        .expect(404);

      expect(response.headers['x-request-id']).toBe(KNOWN_ID);
      expect(response.body.requestId).toBe(KNOWN_ID);
      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(findRequestLog(drainCapturedLogs(), KNOWN_ID)).toMatchObject({
        requestId: KNOWN_ID,
        req: { path: '/api/v1/does-not-exist' },
        res: { statusCode: 404 },
      });
    });
  });

  describe('Auth CSRF', () => {
    let csrfIdentityId: string;

    beforeAll(async () => {
      const passwordHash = await hashSecret(E2E_CSRF_PASSWORD);
      const identity = await prisma.identity.create({
        data: { phone: E2E_CSRF_PHONE, passwordHash },
      });
      csrfIdentityId = identity.id;
    });

    afterAll(async () => {
      await prisma.authSession.deleteMany({ where: { identityId: csrfIdentityId } });
      await prisma.identity.deleteMany({ where: { id: csrfIdentityId } });
    });

    it('login sets ribat_csrf without HttpOnly', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ phone: E2E_CSRF_PHONE, password: E2E_CSRF_PASSWORD })
        .expect(201);

      const setCookie = login.headers['set-cookie'];
      const lines = Array.isArray(setCookie) ? setCookie : [setCookie].filter(Boolean);
      const csrfLine = lines.find((line) => line.startsWith(`${CSRF_COOKIE}=`));
      expect(csrfLine).toBeDefined();
      expect(csrfLine!.toLowerCase()).not.toContain('httponly');
      expect(parseSetCookies(setCookie)[SESSION_COOKIE]).toBeDefined();
    });

    it('POST /auth/logout without CSRF header returns 403 and keeps the session', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ phone: E2E_CSRF_PHONE, password: E2E_CSRF_PASSWORD })
        .expect(201);

      const cookie = browserCookieHeader(login.headers['set-cookie']);

      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('cookie', cookie)
        .expect(403)
        .expect((response) => {
          expect(response.body.error.code).toBe('CSRF_INVALID');
        });

      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('cookie', cookie)
        .expect(200);
    });

    it('POST /auth/logout with CSRF header revokes the session', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ phone: E2E_CSRF_PHONE, password: E2E_CSRF_PASSWORD })
        .expect(201);

      const setCookie = login.headers['set-cookie'];
      const cookie = browserCookieHeader(setCookie);
      const csrf = parseSetCookies(setCookie)[CSRF_COOKIE];

      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('cookie', cookie)
        .set(CSRF_HEADER, csrf)
        .expect(204);

      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('cookie', cookie)
        .expect(401);
    });
  });

  describe('Members and org context', () => {
    let sheikh: AuthenticatedSession;

    beforeEach(async () => {
      sheikh = await loginAs(prisma, app, demoOrgId, 'SHEIKH');
    });

    afterEach(async () => {
      await removeAuthFixtures(prisma, [sheikh.identityId]);
    });

    function authed(session: AuthenticatedSession) {
      return {
        cookie: session.cookie,
        csrf: session.csrf,
        header: session.csrfHeader,
      };
    }

    it('GET /members without session returns 401', () => {
      return request(app.getHttpServer()).get('/api/v1/members').expect(401);
    });

    it('GET /members as MEMBER returns 403', async () => {
      const member = await loginAs(prisma, app, demoOrgId, 'MEMBER');
      try {
        await request(app.getHttpServer())
          .get('/api/v1/members')
          .set('cookie', member.cookie)
          .expect(403);
      } finally {
        await removeAuthFixtures(prisma, [member.identityId]);
      }
    });

    it('POST /members rejects invalid payload with 400', () => {
      const { cookie, csrf, header } = authed(sheikh);
      return request(app.getHttpServer())
        .post('/api/v1/members')
        .set('cookie', cookie)
        .set(header, csrf)
        .send({ firstName: 'Ahmad' })
        .expect(400)
        .expect((response) => {
          expect(response.body.error.code).toBe('VALIDATION_ERROR');
          expect(response.body.error.details.familyName).toBeDefined();
          expect(response.body.error.details.birthDate).toBeDefined();
        });
    });

    it('POST /members creates a member', async () => {
      const { cookie, csrf, header } = authed(sheikh);
      const response = await request(app.getHttpServer())
        .post('/api/v1/members')
        .set('cookie', cookie)
        .set(header, csrf)
        .send(validMember)
        .expect(201);

      expect(response.body.firstName).toBe('Ahmad');
      expect(response.body.organizationId).toBe(demoOrgId);
      expect(response.body.status).toBe('ACTIVE');
    });

    it('GET /members lists active members', async () => {
      const { cookie, csrf, header } = authed(sheikh);
      await request(app.getHttpServer())
        .post('/api/v1/members')
        .set('cookie', cookie)
        .set(header, csrf)
        .send(validMember);

      const response = await request(app.getHttpServer())
        .get('/api/v1/members')
        .set('cookie', cookie)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].firstName).toBe('Ahmad');
    });

    it('GET /members/:id returns one member', async () => {
      const { cookie, csrf, header } = authed(sheikh);
      const created = await request(app.getHttpServer())
        .post('/api/v1/members')
        .set('cookie', cookie)
        .set(header, csrf)
        .send(validMember);

      const memberId = created.body.id;

      const response = await request(app.getHttpServer())
        .get(`/api/v1/members/${memberId}`)
        .set('cookie', cookie)
        .expect(200);

      expect(response.body.id).toBe(memberId);
      expect(response.body.familyName).toBe('Ali');
    });

    it('GET /members/:id returns 404 for cross-tenant access', async () => {
      const { cookie, csrf, header } = authed(sheikh);
      const created = await request(app.getHttpServer())
        .post('/api/v1/members')
        .set('cookie', cookie)
        .set(header, csrf)
        .send(validMember);

      const otherStaff = await loginAs(prisma, app, otherOrgId, 'SHEIKH');
      try {
        await request(app.getHttpServer())
          .get(`/api/v1/members/${created.body.id}`)
          .set('cookie', otherStaff.cookie)
          .expect(404)
          .expect((response) => {
            expect(response.body.error.code).toBe('NOT_FOUND');
          });
      } finally {
        await removeAuthFixtures(prisma, [otherStaff.identityId]);
      }
    });

    it('GET /members omits the other organization', async () => {
      const { cookie, csrf, header } = authed(sheikh);
      const created = await request(app.getHttpServer())
        .post('/api/v1/members')
        .set('cookie', cookie)
        .set(header, csrf)
        .send(validMember)
        .expect(201);

      const otherStaff = await loginAs(prisma, app, otherOrgId, 'SHEIKH');
      try {
        const listed = await request(app.getHttpServer())
          .get('/api/v1/members')
          .set('cookie', otherStaff.cookie)
          .expect(200);

        const ids = listed.body.map((member: { id: string }) => member.id);
        expect(ids).not.toContain(created.body.id);
      } finally {
        await removeAuthFixtures(prisma, [otherStaff.identityId]);
      }
    });

    it('PATCH /members/:id updates a member', async () => {
      const { cookie, csrf, header } = authed(sheikh);
      const created = await request(app.getHttpServer())
        .post('/api/v1/members')
        .set('cookie', cookie)
        .set(header, csrf)
        .send(validMember);

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/members/${created.body.id}`)
        .set('cookie', cookie)
        .set(header, csrf)
        .send({ firstName: 'Omar' })
        .expect(200);

      expect(response.body.firstName).toBe('Omar');
    });

    it('POST /members/:id/archive soft-deletes a member', async () => {
      const { cookie, csrf, header } = authed(sheikh);
      const created = await request(app.getHttpServer())
        .post('/api/v1/members')
        .set('cookie', cookie)
        .set(header, csrf)
        .send(validMember);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/members/${created.body.id}/archive`)
        .set('cookie', cookie)
        .set(header, csrf)
        .expect(201);

      expect(response.body.status).toBe('ARCHIVED');
      expect(response.body.archivedAt).not.toBeNull();
    });

    it('staff in MEMBER view cannot manage members until switched back', async () => {
      const { cookie, csrf, header } = authed(sheikh);

      await request(app.getHttpServer())
        .post('/api/v1/auth/switch-view')
        .set('cookie', cookie)
        .set(header, csrf)
        .send({ activeView: 'MEMBER' })
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/v1/members')
        .set('cookie', cookie)
        .expect(403);

      await request(app.getHttpServer())
        .post('/api/v1/auth/switch-view')
        .set('cookie', cookie)
        .set(header, csrf)
        .send({ activeView: 'ADMIN' })
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/v1/members')
        .set('cookie', cookie)
        .expect(200);
    });

    it('GET /auth/me lists sheikh-only permission for sheikh not org admin', async () => {
      const admin = await loginAs(prisma, app, demoOrgId, 'ORG_ADMIN');
      try {
        const sheikhMe = await request(app.getHttpServer())
          .get('/api/v1/auth/me')
          .set('cookie', sheikh.cookie)
          .expect(200);
        expect(sheikhMe.body.permissions).toContain('memberships.manage_org_admin');

        const adminMe = await request(app.getHttpServer())
          .get('/api/v1/auth/me')
          .set('cookie', admin.cookie)
          .expect(200);
        expect(adminMe.body.permissions).not.toContain('memberships.manage_org_admin');
      } finally {
        await removeAuthFixtures(prisma, [admin.identityId]);
      }
    });

    it('MEMBER cannot switch view', async () => {
      const member = await loginAs(prisma, app, demoOrgId, 'MEMBER');
      try {
        await request(app.getHttpServer())
          .post('/api/v1/auth/switch-view')
          .set('cookie', member.cookie)
          .set(member.csrfHeader, member.csrf)
          .send({ activeView: 'ADMIN' })
          .expect(403);
      } finally {
        await removeAuthFixtures(prisma, [member.identityId]);
      }
    });
  });

  describe('Memberships', () => {
    const staffPassword = 'longenough';

    it('org admin cannot grant ORG_ADMIN access', async () => {
      const sheikh = await loginAs(prisma, app, demoOrgId, 'SHEIKH', staffPassword);
      const admin = await loginAs(prisma, app, demoOrgId, 'ORG_ADMIN', staffPassword);
      try {
        const created = await request(app.getHttpServer())
          .post('/api/v1/members')
          .set('cookie', sheikh.cookie)
          .set(sheikh.csrfHeader, sheikh.csrf)
          .send({ ...validMember, phone: '+963944000301' })
          .expect(201);

        await request(app.getHttpServer())
          .post(`/api/v1/members/${created.body.id}/access`)
          .set('cookie', admin.cookie)
          .set(admin.csrfHeader, admin.csrf)
          .send({ role: 'ORG_ADMIN', currentPassword: staffPassword })
          .expect(403);
      } finally {
        await removeAuthFixtures(prisma, [sheikh.identityId, admin.identityId]);
      }
    });

    it('sheikh can grant member access and list memberships', async () => {
      const sheikh = await loginAs(prisma, app, demoOrgId, 'SHEIKH', staffPassword);
      try {
        const created = await request(app.getHttpServer())
          .post('/api/v1/members')
          .set('cookie', sheikh.cookie)
          .set(sheikh.csrfHeader, sheikh.csrf)
          .send({ ...validMember, phone: '+963944000302' })
          .expect(201);

        const access = await request(app.getHttpServer())
          .post(`/api/v1/members/${created.body.id}/access`)
          .set('cookie', sheikh.cookie)
          .set(sheikh.csrfHeader, sheikh.csrf)
          .send({ role: 'MEMBER', currentPassword: staffPassword })
          .expect(201);

        expect(access.body.setupCode).toMatch(/^[A-Z0-9]{8}$/);
        expect(access.body.membershipId).toMatch(UUID);

        const listed = await request(app.getHttpServer())
          .get('/api/v1/memberships')
          .set('cookie', sheikh.cookie)
          .expect(200);

        const ids = listed.body.map((row: { memberId: string | null }) => row.memberId);
        expect(ids).toContain(created.body.id);

        const grantedIdentity = await prisma.identity.findUnique({
          where: { phone: '+963944000302' },
          select: { id: true },
        });
        if (grantedIdentity) {
          await removeAuthFixtures(prisma, [grantedIdentity.id]);
        }
      } finally {
        await removeAuthFixtures(prisma, [sheikh.identityId]);
      }
    });
  });

  describe('Households', () => {
    it('links siblings into one household', async () => {
      const sheikh = await loginAs(prisma, app, demoOrgId, 'SHEIKH');
      try {
        const a = await request(app.getHttpServer())
          .post('/api/v1/members')
          .set('cookie', sheikh.cookie)
          .set(sheikh.csrfHeader, sheikh.csrf)
          .send({ ...validMember, firstName: 'SiblingA' })
          .expect(201);
        const b = await request(app.getHttpServer())
          .post('/api/v1/members')
          .set('cookie', sheikh.cookie)
          .set(sheikh.csrfHeader, sheikh.csrf)
          .send({ ...validMember, firstName: 'SiblingB', familyName: 'B' })
          .expect(201);

        const linked = await request(app.getHttpServer())
          .post(`/api/v1/members/${a.body.id}/household`)
          .set('cookie', sheikh.cookie)
          .set(sheikh.csrfHeader, sheikh.csrf)
          .send({ siblingMemberId: b.body.id })
          .expect(201);

        expect(linked.body.memberIds).toEqual(expect.arrayContaining([a.body.id, b.body.id]));

        const detail = await request(app.getHttpServer())
          .get(`/api/v1/members/${a.body.id}`)
          .set('cookie', sheikh.cookie)
          .expect(200);
        expect(detail.body.siblingMemberIds).toContain(b.body.id);
      } finally {
        await removeAuthFixtures(prisma, [sheikh.identityId]);
      }
    });
  });

  describe('Organization setup', () => {
    it('GET /setup/status reports setup is not required when orgs exist', () => {
      return request(app.getHttpServer())
        .get('/api/v1/setup/status')
        .expect(200)
        .expect((response) => {
          expect(response.body.setupRequired).toBe(false);
        });
    });

    it('POST /setup/organization returns 409 when setup is already complete', () => {
      return request(app.getHttpServer())
        .post('/api/v1/setup/organization')
        .send({
          name: 'Another Mosque',
          timezone: 'Asia/Damascus',
          latitude: 33.5138,
          longitude: 36.2765,
          prayerMethod: 'UmmAlQura',
          locale: 'ar',
          sheikh: {
            firstName: 'Omar',
            fatherName: 'Ali',
            familyName: 'Hassan',
            phone: '+963944000199',
          },
        })
        .expect(409)
        .expect((response) => {
          expect(response.body.error.code).toBe('CONFLICT');
        });
    });

    it('GET /organization requires organization.manage', async () => {
      const member = await loginAs(prisma, app, demoOrgId, 'MEMBER');
      try {
        await request(app.getHttpServer())
          .get('/api/v1/organization')
          .set('cookie', member.cookie)
          .expect(403);
      } finally {
        await removeAuthFixtures(prisma, [member.identityId]);
      }
    });

    it('GET /organization returns org settings for sheikh', async () => {
      const sheikh = await loginAs(prisma, app, demoOrgId, 'SHEIKH');
      try {
        const response = await request(app.getHttpServer())
          .get('/api/v1/organization')
          .set('cookie', sheikh.cookie)
          .expect(200);
        expect(response.body.id).toBe(demoOrgId);
        expect(response.body.slug).toBe('e2e-demo-mosque');
      } finally {
        await removeAuthFixtures(prisma, [sheikh.identityId]);
      }
    });
  });

  describe('Audit', () => {
    let sheikh: AuthenticatedSession;

    beforeEach(async () => {
      sheikh = await loginAs(prisma, app, demoOrgId, 'SHEIKH');
    });

    afterEach(async () => {
      await prisma.auditLog.deleteMany({ where: { organizationId: demoOrgId } });
      await removeAuthFixtures(prisma, [sheikh.identityId]);
    });

    it('GET /audit without audit.read returns 403 for org admin in member view', async () => {
      const admin = await loginAs(prisma, app, demoOrgId, 'ORG_ADMIN');
      try {
        await request(app.getHttpServer())
          .post('/api/v1/auth/switch-view')
          .set('cookie', admin.cookie)
          .set(admin.csrfHeader, admin.csrf)
          .send({ activeView: 'MEMBER' })
          .expect(200);

        await request(app.getHttpServer())
          .get('/api/v1/audit')
          .set('cookie', admin.cookie)
          .expect(403);
      } finally {
        await removeAuthFixtures(prisma, [admin.identityId]);
      }
    });

    it('POST /members writes a member.created audit row without PII', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/members')
        .set('cookie', sheikh.cookie)
        .set(sheikh.csrfHeader, sheikh.csrf)
        .send(validMember)
        .expect(201);

      const listed = await request(app.getHttpServer())
        .get('/api/v1/audit')
        .set('cookie', sheikh.cookie)
        .expect(200);

      const row = listed.body.find(
        (entry: { action: string; entityId: string }) =>
          entry.action === 'member.created' && entry.entityId === created.body.id,
      );
      expect(row).toBeDefined();
      expect(row.after).toEqual({
        id: created.body.id,
        status: 'ACTIVE',
        householdId: null,
      });
      expect(JSON.stringify(row)).not.toMatch(/Ahmad|Ali|Hassan/);
    });

    it('staff in MEMBER view records permission.denied when listing audit', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/switch-view')
        .set('cookie', sheikh.cookie)
        .set(sheikh.csrfHeader, sheikh.csrf)
        .send({ activeView: 'MEMBER' })
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/v1/audit')
        .set('cookie', sheikh.cookie)
        .expect(403);

      const denied = await prisma.auditLog.findFirst({
        where: { organizationId: demoOrgId, action: 'permission.denied' },
        orderBy: { createdAt: 'desc' },
      });
      expect(denied).not.toBeNull();
      expect(denied!.after).toMatchObject({
        required: ['audit.read'],
        method: 'GET',
      });
    });
  });
});