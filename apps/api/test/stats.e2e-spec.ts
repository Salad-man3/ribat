process.env.JOBS_WORKER = 'off';
import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/api-exception.filter';
import { createPrismaClient } from '../src/prisma/create-prisma-client.js';
import { StatsRollupService } from '../src/stats/stats-rollup.service';
import { loginAs, type AuthenticatedSession } from './fixtures/auth-session';
import { removeTwoOrganizations, twoOrganizations } from './fixtures/organizations';

const prisma = createPrismaClient();

describe('Statistics (e2e)', () => {
  let app: INestApplication<App>;
  let sheikh: AuthenticatedSession;
  let otherSheikh: AuthenticatedSession;
  let orgId: string;
  let orgs: Awaited<ReturnType<typeof twoOrganizations>>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    app.useLogger(app.get(Logger));
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();

    orgs = await twoOrganizations(prisma, 'stats');
    orgId = orgs.demo.id;
    sheikh = await loginAs(prisma, app, orgId, 'SHEIKH');
    otherSheikh = await loginAs(prisma, app, orgs.other.id, 'SHEIKH');

    const rollup = app.get(StatsRollupService);
    await rollup.rollupDay(orgId, '2026-01-15');
  });

  afterAll(async () => {
    await app.close();
    await removeTwoOrganizations(prisma, orgs);
    await prisma.$disconnect();
  });

  it('returns dashboard for staff with courses.manage', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/stats/dashboard')
      .set('cookie', sheikh.cookie)
      .expect(200);
    expect(res.body.asOf).toBeDefined();
    expect(res.body.mosque).toBeDefined();
    expect(res.body.courses).toEqual(expect.any(Array));
  });

  it('hides dashboard from cross-tenant course stats', async () => {
    const courses = await prisma.course.findMany({
      where: { organizationId: orgId },
      take: 1,
    });
    if (courses.length === 0) return;
    await request(app.getHttpServer())
      .get(`/api/v1/stats/courses/${courses[0].id}`)
      .set('cookie', otherSheikh.cookie)
      .expect(404);
  });
});
