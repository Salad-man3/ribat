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

  describe('Members', () => {
    it('POST /members rejects invalid payload with 400', () => {
      return request(app.getHttpServer())
        .post('/api/v1/members')
        .set('X-Organization-Id', demoOrgId)
        .send({ firstName: 'Ahmad' })
        .expect(400)
        .expect((response) => {
          expect(response.body.error.code).toBe('VALIDATION_ERROR');
          expect(response.body.error.details.familyName).toBeDefined();
          expect(response.body.error.details.birthDate).toBeDefined();
        });
    });

    it('POST /members rejects missing organization header with 400', () => {
      return request(app.getHttpServer())
        .post('/api/v1/members')
        .send(validMember)
        .expect(400)
        .expect((response) => {
          expect(response.body.error.code).toBe('VALIDATION_ERROR');
        });
    });

    it('POST /members creates a member', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/members')
        .set('X-Organization-Id', demoOrgId)
        .send(validMember)
        .expect(201);

      expect(response.body.firstName).toBe('Ahmad');
      expect(response.body.organizationId).toBe(demoOrgId);
      expect(response.body.status).toBe('ACTIVE');
    });

    it('GET /members lists active members', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/members')
        .set('X-Organization-Id', demoOrgId)
        .send(validMember);

      const response = await request(app.getHttpServer())
        .get('/api/v1/members')
        .set('X-Organization-Id', demoOrgId)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].firstName).toBe('Ahmad');
    });

    it('GET /members/:id returns one member', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/members')
        .set('X-Organization-Id', demoOrgId)
        .send(validMember);

      const memberId = created.body.id;

      const response = await request(app.getHttpServer())
        .get(`/api/v1/members/${memberId}`)
        .set('X-Organization-Id', demoOrgId)
        .expect(200);

      expect(response.body.id).toBe(memberId);
      expect(response.body.familyName).toBe('Ali');
    });

    it('GET /members/:id returns 404 for cross-tenant access', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/members')
        .set('X-Organization-Id', demoOrgId)
        .send(validMember);

      await request(app.getHttpServer())
        .get(`/api/v1/members/${created.body.id}`)
        .set('X-Organization-Id', otherOrgId)
        .expect(404)
        .expect((response) => {
          expect(response.body.error.code).toBe('NOT_FOUND');
        });
    });

    it('GET /members omits the other organization', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/members')
        .set('X-Organization-Id', demoOrgId)
        .send(validMember)
        .expect(201);

      const listed = await request(app.getHttpServer())
        .get('/api/v1/members')
        .set('X-Organization-Id', otherOrgId)
        .expect(200);

      const ids = listed.body.map((member: { id: string }) => member.id);
      expect(ids).not.toContain(created.body.id);
    });

    it('PATCH /members/:id updates a member', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/members')
        .set('X-Organization-Id', demoOrgId)
        .send(validMember);

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/members/${created.body.id}`)
        .set('X-Organization-Id', demoOrgId)
        .send({ firstName: 'Omar' })
        .expect(200);

      expect(response.body.firstName).toBe('Omar');
    });

    it('POST /members/:id/archive soft-deletes a member', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/members')
        .set('X-Organization-Id', demoOrgId)
        .send(validMember);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/members/${created.body.id}/archive`)
        .set('X-Organization-Id', demoOrgId)
        .expect(201);

      expect(response.body.status).toBe('ARCHIVED');
      expect(response.body.archivedAt).not.toBeNull();
    });
  });
});