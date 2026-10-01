import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/api-exception.filter';

const prisma = new PrismaClient();

const validMember = {
  firstName: 'Ahmad',
  fatherName: 'Hassan',
  familyName: 'Ali',
  birthDate: '2015-03-01',
  joinedAt: '2024-09-01',
};

describe('API (e2e)', () => {
  let app: INestApplication<App>;
  let demoOrgId: string;
  let otherOrgId: string;

  beforeAll(async () => {
    const demoOrg = await prisma.organization.upsert({
      where: { slug: 'e2e-demo-mosque' },
      update: {},
      create: {
        name: 'E2E Demo Mosque',
        slug: 'e2e-demo-mosque',
        timezone: 'Asia/Damascus',
        latitude: 33.5138,
        longitude: 36.2765,
        prayerMethod: 'UmmAlQura',
      },
    });

    const otherOrg = await prisma.organization.upsert({
      where: { slug: 'e2e-other-mosque' },
      update: {},
      create: {
        name: 'E2E Other Mosque',
        slug: 'e2e-other-mosque',
        timezone: 'Asia/Damascus',
        latitude: 33.5138,
        longitude: 36.2765,
        prayerMethod: 'UmmAlQura',
      },
    });

    demoOrgId = demoOrg.id;
    otherOrgId = otherOrg.id;
  });

  afterAll(async () => {
    await prisma.member.deleteMany({
      where: { organizationId: { in: [demoOrgId, otherOrgId] } },
    });
    await prisma.organization.deleteMany({
      where: { slug: { in: ['e2e-demo-mosque', 'e2e-other-mosque'] } },
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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