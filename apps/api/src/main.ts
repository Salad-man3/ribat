import 'dotenv/config';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { loadEnv } from './config/env';
import { buildAssetLinksJson } from './twa/assetlinks';

async function bootstrap() {
  const env = loadEnv();
  if (env.JOBS_WORKER === 'only') {
    // Same image, no HTTP: the SessionsWorker provider consumes the queue (ADR-0006).
    const worker = await NestFactory.createApplicationContext(AppModule, {
      bufferLogs: true,
    });
    worker.useLogger(worker.get(Logger));
    worker.enableShutdownHooks();
    return;
  }
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.disable('x-powered-by');
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  const spaCsp =
    "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-src 'none'; frame-ancestors 'none'";
  const apiCsp = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'";

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    const p = req.path;
    if (p.startsWith('/api/docs')) {
      next();
      return;
    }
    if (p.startsWith('/api')) {
      res.setHeader('Content-Security-Policy', apiCsp);
    } else if (env.SERVE_WEB) {
      res.setHeader('Content-Security-Policy', spaCsp);
    }
    next();
  });

  app.setGlobalPrefix('api/v1');
  // A full sync batch (SYNC-12: 200 mutations with notes) can pass Express's 100 kB default.
  app.useBodyParser('json', { limit: '1mb' });
  app.useGlobalFilters(new ApiExceptionFilter());

  app
    .getHttpAdapter()
    .getInstance()
    .get('/.well-known/assetlinks.json', (_req: Request, res: Response) => {
      if (env.TWA_SHA256_CERT_FINGERPRINTS.length === 0) {
        res.status(404).end();
        return;
      }
      res
        .type('application/json')
        .send(
          buildAssetLinksJson(
            env.TWA_PACKAGE_NAME,
            env.TWA_SHA256_CERT_FINGERPRINTS,
          ),
        );
    });

  if (env.API_DOCS) {
    const config = new DocumentBuilder()
      .setTitle('Ribat API')
      .setDescription(
        'Multi-tenant mosque education API. Request and response shapes are the Zod schemas in packages/shared.',
      )
      .setVersion('0.1.0-beta')
      .addCookieAuth('ribat_session')
      .build();
    SwaggerModule.setup(
      'api/docs',
      app,
      SwaggerModule.createDocument(app, config),
    );
  }

  if (env.SERVE_WEB) {
    const dist = env.WEB_DIST_PATH ?? join(process.cwd(), '../web/dist');
    if (existsSync(dist)) {
      app.useStaticAssets(dist);
      app.use((req: Request, res: Response, next: NextFunction) => {
        if (
          req.path.startsWith('/api/') ||
          req.path.startsWith('/.well-known/')
        )
          return next();
        res.sendFile(join(dist, 'index.html'));
      });
    }
  }

  await app.listen(env.PORT);
}

void bootstrap();
