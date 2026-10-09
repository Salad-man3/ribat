import 'dotenv/config';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { loadEnv } from './config/env';

async function bootstrap() {
  const env = loadEnv();
  if (env.JOBS_WORKER === 'only') {
    // Same image, no HTTP: the SessionsWorker provider consumes the queue (ADR-0006).
    const worker = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
    worker.useLogger(worker.get(Logger));
    worker.enableShutdownHooks();
    return;
  }
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new ApiExceptionFilter());

  if (env.SERVE_WEB) {
    const dist = env.WEB_DIST_PATH ?? join(process.cwd(), '../web/dist');
    if (existsSync(dist)) {
      app.useStaticAssets(dist);
      app.use((req: Request, res: Response, next: NextFunction) => {
        if (req.path.startsWith('/api/')) return next();
        res.sendFile(join(dist, 'index.html'));
      });
    }
  }

  await app.listen(env.PORT);
}

void bootstrap();