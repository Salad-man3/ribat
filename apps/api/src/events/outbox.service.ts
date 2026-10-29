import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { Queue, Worker, type Job } from 'bullmq';
import type IORedis from 'ioredis';
import { conflict, notFound } from '../common/errors';
import { safeErrorSummary } from '../common/safe-error';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { bullConnection } from '../jobs/sessions-queue';
import { EveningService } from '../notifications/evening.service';
import { PrismaService } from '../prisma/prisma.service';
import { StatsRollupService } from '../stats/stats-rollup.service';
import type { EventPayload, EventType } from './emit';
import { EVENTS_QUEUE } from './events-queue';
import { HANDLERS, SUBSCRIPTIONS } from './handlers';

export { EVENTS_QUEUE };
/** 07-events-and-jobs §3: retries after 10 s, 1 min, 5 min, 30 min; the fifth failure is a dead letter. */
export const RETRY_DELAYS_MS = [10_000, 60_000, 300_000, 1_800_000];
export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

type DeliverJob = { deliveryId: string };
type EveningJob = { organizationId: string };
type StatsOrgJob = { organizationId: string };

export type FailedDelivery = {
  id: string;
  eventId: string;
  eventType: string;
  handler: string;
  status: 'FAILED' | 'DEAD';
  attempts: number;
  lastError: string | null;
  occurredAt: string;
  requestId: string | null;
};

/**
 * ADR-0009. The DomainEvent table is the source of truth; Redis only carries the work.
 * Losing Redis delays reactions and loses nothing: undispatched rows wait, and the sweep
 * re-enqueues deliveries whose job never arrived.
 */
@Injectable()
export class OutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxService.name);
  private readonly connection: IORedis;
  readonly queue: Queue;
  private worker?: Worker;
  private workerConnection?: IORedis;
  private timer?: NodeJS.Timeout;
  private ticks = 0;
  private running = false;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly evening: EveningService,
    private readonly statsRollup: StatsRollupService,
  ) {
    this.connection = bullConnection(env);
    this.queue = new Queue(EVENTS_QUEUE, {
      connection: this.connection,
      defaultJobOptions: { removeOnComplete: 500, removeOnFail: 1000 },
    });
  }

  async onModuleInit() {
    if (this.env.JOBS_WORKER === 'off') return;
    this.workerConnection = bullConnection(this.env);
    this.worker = new Worker(EVENTS_QUEUE, (job) => this.process(job), {
      connection: this.workerConnection,
      concurrency: 4,
      settings: { backoffStrategy: (attemptsMade: number) => RETRY_DELAYS_MS[attemptsMade - 1] ?? 7_200_000 },
    });
    this.worker.on('failed', (job, error) => this.logger.warn(`events job ${job?.id} failed: ${safeErrorSummary(error)}`));

    const orgs = await this.prisma.platform.organization.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, timezone: true },
    });
    for (const org of orgs) await this.scheduleEvening(org);

    // The dispatcher loop (§3): every second; the sweep every minute.
    this.timer = setInterval(() => void this.tick(), 1_000);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.dispatchOnce();
      if (++this.ticks % 60 === 0) await this.sweep();
    } catch (error) {
      this.logger.error(`dispatcher: ${safeErrorSummary(error)}`);
    } finally {
      this.running = false;
    }
  }

  /** "End of day" per organization, in its own timezone (SH-01). */
  async scheduleEvening(org: { id: string; timezone: string }) {
    await this.queue.upsertJobScheduler(
      `evening:${org.id}`,
      { pattern: `${EveningService.MINUTE} ${EveningService.HOUR} * * *`, tz: org.timezone },
      { name: 'evening-org', data: { organizationId: org.id } satisfies EveningJob },
    );
  }

  /**
   * §3 steps 1–3. `FOR UPDATE SKIP LOCKED` lets several workers share the table with no
   * coordination. Jobs are enqueued after commit; a crash in between leaves PENDING rows
   * that `sweep` picks up, and the job id (= delivery id) stops a double enqueue.
   */
  async dispatchOnce(limit = 100): Promise<number> {
    const deliveries = await this.prisma.platform.$transaction(async (tx) => {
      const events = await tx.$queryRaw<{ id: string; type: string }[]>(Prisma.sql`
        SELECT id, type FROM "DomainEvent"
        WHERE "dispatchedAt" IS NULL
        ORDER BY "occurredAt"
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED`);
      if (events.length === 0) return [];
      await tx.eventDelivery.createMany({
        data: events.flatMap((e) =>
          (SUBSCRIPTIONS[e.type as EventType] ?? []).map((handler) => ({ eventId: e.id, handler })),
        ),
        skipDuplicates: true,
      });
      await tx.domainEvent.updateMany({
        where: { id: { in: events.map((e) => e.id) } },
        data: { dispatchedAt: new Date() },
      });
      return tx.eventDelivery.findMany({
        where: { eventId: { in: events.map((e) => e.id) }, status: 'PENDING' },
        select: { id: true },
      });
    });
    for (const d of deliveries) await this.enqueue(d.id, d.id);
    return deliveries.length;
  }

  /** Deliveries still PENDING a minute after creation never got a job; give them one. */
  async sweep(): Promise<number> {
    const stuck = await this.prisma.platform.eventDelivery.findMany({
      where: { status: 'PENDING', createdAt: { lt: new Date(Date.now() - 60_000) } },
      select: { id: true },
      take: 500,
    });
    for (const d of stuck) await this.enqueue(d.id, d.id);
    return stuck.length;
  }

  private enqueue(deliveryId: string, jobId: string) {
    return this.queue.add('deliver', { deliveryId } satisfies DeliverJob, {
      jobId,
      attempts: MAX_ATTEMPTS,
      backoff: { type: 'custom' },
    });
  }

  private async process(job: Job): Promise<unknown> {
    if (job.name === 'deliver') {
      return this.deliver((job.data as DeliverJob).deliveryId, job.attemptsMade + 1 >= (job.opts.attempts ?? 1));
    }
    if (job.name === 'evening-org') return this.evening.run((job.data as EveningJob).organizationId);
    if (job.name === 'stats-org') return this.statsRollup.run((job.data as StatsOrgJob).organizationId);
    throw new Error(`Unknown events job ${job.name}`);
  }

  /**
   * Runs one handler for one event. The handler's writes and the DONE mark share a
   * transaction, so a crash re-runs the whole thing and the dedupe keys absorb it.
   * `final` turns a failure into a dead letter (EV-05).
   */
  async deliver(deliveryId: string, final: boolean): Promise<'done' | 'skipped'> {
    const delivery = await this.prisma.platform.eventDelivery.findUnique({
      where: { id: deliveryId },
      include: { event: true },
    });
    if (!delivery) throw new Error(`Delivery ${deliveryId} not found`);
    if (delivery.status === 'DONE') return 'skipped';

    const handler = HANDLERS[delivery.handler];
    try {
      if (!handler) throw new Error(`No handler named ${delivery.handler}`);
      await this.prisma.forOrganization(delivery.event.organizationId).$transaction(async (tx) => {
        await handler(tx, delivery.event, delivery.event.payload as EventPayload);
        await tx.eventDelivery.update({
          where: { id: deliveryId },
          data: { status: 'DONE', attempts: { increment: 1 }, completedAt: new Date(), lastError: null },
        });
      });
      return 'done';
    } catch (error) {
      const message = safeErrorSummary(error);
      await this.prisma.platform.eventDelivery.update({
        where: { id: deliveryId },
        data: { status: final ? 'DEAD' : 'FAILED', attempts: { increment: 1 }, lastError: message },
      });
      if (final) this.logger.error(`dead letter: ${delivery.handler} for event ${delivery.eventId}: ${message}`);
      throw error;
    }
  }

  /** The staff "failed events" view (T411). */
  async listFailed(organizationId: string): Promise<FailedDelivery[]> {
    const rows = await this.prisma.platform.eventDelivery.findMany({
      where: { status: { in: ['FAILED', 'DEAD'] }, event: { organizationId } },
      include: { event: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((r) => ({
      id: r.id,
      eventId: r.eventId,
      eventType: r.event.type,
      handler: r.handler,
      status: r.status as 'FAILED' | 'DEAD',
      attempts: r.attempts,
      lastError: r.lastError,
      occurredAt: r.event.occurredAt.toISOString(),
      requestId: r.event.requestId,
    }));
  }

  /** A human retries a dead letter; it starts a fresh run of attempts. */
  async retry(organizationId: string, deliveryId: string): Promise<void> {
    const row = await this.prisma.platform.eventDelivery.findFirst({
      where: { id: deliveryId, event: { organizationId } },
    });
    if (!row) throw notFound('Delivery');
    if (row.status !== 'DEAD' && row.status !== 'FAILED') throw conflict('Only a failed delivery can be retried');
    await this.prisma.platform.eventDelivery.update({
      where: { id: deliveryId },
      data: { status: 'PENDING', attempts: 0 },
    });
    await this.enqueue(deliveryId, `${deliveryId}:retry:${Date.now()}`);
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.worker?.close();
    await this.queue.close();
    await this.connection.quit().catch(() => undefined);
    await this.workerConnection?.quit().catch(() => undefined);
  }
}
