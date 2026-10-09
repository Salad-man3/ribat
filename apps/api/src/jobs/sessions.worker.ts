import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Worker, type Job } from 'bullmq';
import type IORedis from 'ioredis';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { SessionGeneratorService } from '../courses/session-generator.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  bullConnection,
  SESSIONS_QUEUE,
  SessionsQueue,
  type SessionsJob,
} from './sessions-queue';

/**
 * T210/T211. Consumer side of the `sessions` queue. Runs inside the API (`JOBS_WORKER=inline`)
 * or as its own process from the same image (`JOBS_WORKER=only`, ADR-0006).
 */
@Injectable()
export class SessionsWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SessionsWorker.name);
  private worker?: Worker;
  private connection?: IORedis;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly generator: SessionGeneratorService,
    private readonly prisma: PrismaService,
    private readonly queue: SessionsQueue,
  ) {}

  async onModuleInit() {
    if (this.env.JOBS_WORKER === 'off') return;
    this.connection = bullConnection(this.env);
    this.worker = new Worker(
      SESSIONS_QUEUE,
      (job) => this.process(job as Job<SessionsJob['data']>),
      {
        connection: this.connection,
        concurrency: 2,
      },
    );
    this.worker.on('failed', (job, error) =>
      this.logger.error(`job ${job?.name} ${job?.id} failed: ${error.message}`),
    );

    // Re-register every organization's nightly run, so new orgs and timezone changes
    // are picked up even if the API missed telling the queue.
    const orgs = await this.prisma.platform.organization.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, timezone: true },
    });
    for (const org of orgs) {
      await this.queue.scheduleNightly(org);
      // Catch up on boot: a fresh deploy or a long outage should not wait for 02:00.
      await this.queue.generateOrganization(org.id);
    }
  }

  async process(job: Job<SessionsJob['data']>): Promise<unknown> {
    if (job.name === 'generate-course' && 'courseId' in job.data) {
      return this.generator.reconcileCourse(
        job.data.organizationId,
        job.data.courseId,
      );
    }
    if (job.name === 'generate-org') {
      return {
        created: await this.generator.reconcileOrganization(
          job.data.organizationId,
        ),
      };
    }
    throw new Error(`Unknown sessions job ${job.name}`);
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.connection?.quit().catch(() => undefined);
  }
}
