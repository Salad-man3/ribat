import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';

export const SESSIONS_QUEUE = 'sessions';

export type SessionsJob =
  | {
      name: 'generate-course';
      data: { organizationId: string; courseId: string };
    }
  | { name: 'generate-org'; data: { organizationId: string } };

/** BullMQ needs `maxRetriesPerRequest: null` on its connections. */
export function bullConnection(env: Env): IORedis {
  return new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
}

/**
 * Producer side. Redis is not the source of truth (ADR-0006): if an enqueue fails,
 * the request still succeeds and the nightly run catches up.
 */
@Injectable()
export class SessionsQueue implements OnModuleDestroy {
  private readonly logger = new Logger(SessionsQueue.name);
  private readonly connection: IORedis;
  readonly queue: Queue;

  constructor(@Inject(ENV) env: Env) {
    this.connection = bullConnection(env);
    this.queue = new Queue(SESSIONS_QUEUE, {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: 200,
        removeOnFail: 500,
      },
    });
  }

  /** Generation is idempotent, so duplicate jobs are harmless and need no dedupe key. */
  async generateCourse(
    organizationId: string,
    courseId: string,
  ): Promise<void> {
    await this.safely(() =>
      this.queue.add('generate-course', { organizationId, courseId }),
    );
  }

  /** After org-wide changes (timezone, coordinates, prayer method or offsets). */
  async generateOrganization(organizationId: string): Promise<void> {
    await this.safely(() => this.queue.add('generate-org', { organizationId }));
  }

  /** One nightly run per organization at 02:00 in its own timezone (SH-01). */
  async scheduleNightly(org: { id: string; timezone: string }): Promise<void> {
    await this.safely(() =>
      this.queue.upsertJobScheduler(
        `nightly:${org.id}`,
        { pattern: '0 2 * * *', tz: org.timezone },
        { name: 'generate-org', data: { organizationId: org.id } },
      ),
    );
  }

  private async safely(run: () => Promise<unknown>): Promise<void> {
    try {
      // With maxRetriesPerRequest: null a dead Redis would hang the request; give up after 2s.
      await Promise.race([
        run(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timed out')), 2_000).unref(),
        ),
      ]);
    } catch (error) {
      this.logger.warn(
        `sessions queue unavailable: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async onModuleDestroy() {
    await this.queue.close();
    await this.connection.quit().catch(() => undefined);
  }
}
