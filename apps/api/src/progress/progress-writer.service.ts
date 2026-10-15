import { HttpException, Injectable } from '@nestjs/common';
import type { MaterialKind, WriteSource } from '@prisma/client';
import { ayahsInRange, pagesForRange, validateRange } from '@ribat/quran-data';
import type {
  AttendanceMarkPayload,
  AyahRangeInput,
  CreateTestInput,
  MaterialLogPayload,
  MemorizationLogPayload,
  MemorizationTestResponse,
  SyncMutationInput,
  SyncResult,
} from '@ribat/shared';
import type { AuditContext } from '../audit/audit-context';
import { AuditService } from '../audit/audit.service';
import type { OrgContext } from '../auth/org-context.guard';
import {
  badRequest,
  conflict,
  forbidden,
  isUniqueViolation,
  notFound,
} from '../common/errors';
import { dateIn } from '../common/zoned-time';
import { PrismaService, type OrgTx } from '../prisma/prisma.service';
import {
  ClassScopeService,
  isStaffContext,
  type ClassScope,
} from './class-scope.service';
import { writeSummary } from './memorization-summary';
import {
  clampCapturedAt,
  incomingAttendanceWins,
  teacherMayWriteSession,
} from './policy';
import { toAttendanceResponse, toTestResponse } from './progress.mapper';

/**
 * One write in flight. `memo` lives for one request: inside a 200-mutation batch the same
 * course, enrollment and material are looked up once, not 200 times. It never outlives the
 * request, so authorisation is still evaluated at replay time (PERM-12).
 */
type Write = {
  org: OrgContext;
  audit: AuditContext;
  source: WriteSource;
  now: Date;
  memo: Map<string, Promise<unknown>>;
};
type Applied = Omit<SyncResult, 'idempotencyKey'>;

function once<T>(w: Write, key: string, load: () => Promise<T>): Promise<T> {
  let hit = w.memo.get(key) as Promise<T> | undefined;
  if (!hit) {
    hit = load();
    hit.catch(() => undefined); // awaited by every caller; this only silences the cached copy
    w.memo.set(key, hit);
  }
  return hit;
}

/**
 * The one write path for attendance and progress. The online endpoints and the offline
 * replay (POST /sync/mutations) both come through here, so an invariant cannot hold in one
 * and not the other. Per mutation: authorise now (PERM-12), then one transaction that writes
 * the row, the SyncMutation record and the audit entry (SYNC-09).
 */
@Injectable()
export class ProgressWriterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly scope: ClassScopeService,
  ) {}

  /**
   * SYNC-08/09: each mutation on its own, a refusal becomes a `rejected` result and never fails
   * the batch. Order matters only within one student and entity, so mutations are split into
   * lanes by what they write; a lane runs in the order sent, and lanes run side by side.
   */
  async applyBatch(
    org: OrgContext,
    audit: AuditContext,
    mutations: SyncMutationInput[],
    source: WriteSource,
  ): Promise<SyncResult[]> {
    const known = await this.prisma
      .forOrganization(org.organizationId)
      .syncMutation.findMany({
        where: {
          idempotencyKey: { in: mutations.map((m) => m.idempotencyKey) },
        },
      });
    const stored = new Map(
      known.map((row) => [row.idempotencyKey, duplicateOf(row.result)]),
    );
    const memo = new Map<string, Promise<unknown>>();

    const lanes = new Map<string, number[]>();
    mutations.forEach((m, i) => {
      const key = laneOf(m);
      lanes.set(key, [...(lanes.get(key) ?? []), i]);
    });
    const queue = [...lanes.values()];
    const results: SyncResult[] = Array.from({ length: mutations.length });
    const worker = async () => {
      for (let lane = queue.shift(); lane; lane = queue.shift())
        for (const i of lane) {
          const m = mutations[i];
          results[i] =
            stored.get(m.idempotencyKey) ??
            (await this.applyCaught(
              { org, audit, source, now: new Date(), memo },
              m,
            ));
        }
    };
    // ponytail: 4 lanes at once fits Prisma's default pool on a 2-CPU host; raise with the pool size.
    await Promise.all(
      Array.from({ length: Math.min(4, queue.length) }, worker),
    );
    return results;
  }

  /** For the online endpoints: refusals surface as HTTP errors. */
  applyOrThrow(
    org: OrgContext,
    audit: AuditContext,
    mutation: SyncMutationInput,
    source: WriteSource,
  ) {
    return this.applyOne(
      { org, audit, source, now: new Date(), memo: new Map() },
      mutation,
    );
  }

  private async applyCaught(
    w: Write,
    mutation: SyncMutationInput,
  ): Promise<SyncResult> {
    try {
      return await this.applyOne(w, mutation);
    } catch (error) {
      if (!(error instanceof HttpException)) throw error;
      const body = error.getResponse() as {
        error?: { code?: string; message?: string };
      };
      return {
        idempotencyKey: mutation.idempotencyKey,
        status: 'rejected',
        error: {
          code: body.error?.code ?? 'ERROR',
          message: body.error?.message ?? error.message,
        },
      };
    }
  }

  private async applyOne(
    w: Write,
    mutation: SyncMutationInput,
    retried = false,
  ): Promise<SyncResult> {
    const { org } = w;
    const db = this.prisma.forOrganization(org.organizationId);
    try {
      const prepared = await this.prepare(w, mutation);
      return await db.$transaction(async (tx) => {
        const applied = await prepared(tx);
        const result: SyncResult = {
          idempotencyKey: mutation.idempotencyKey,
          ...applied,
        };
        await tx.syncMutation.create({
          data: {
            organizationId: org.organizationId,
            membershipId: org.membershipId,
            idempotencyKey: mutation.idempotencyKey,
            type: mutation.type,
            status: result.status === 'superseded' ? 'SUPERSEDED' : 'APPLIED',
            result,
          },
        });
        return result;
      });
    } catch (error) {
      if (!isUniqueViolation(error) || retried) throw error;
      // The key was already applied (a resend, or the same key twice in one batch),
      // or two first marks raced on one (session, enrollment). Look again.
      const stored = await db.syncMutation.findFirst({
        where: { idempotencyKey: mutation.idempotencyKey },
      });
      if (stored) return duplicateOf(stored.result);
      return this.applyOne(w, mutation, true);
    }
  }

  /** Validation and authorisation outside the transaction; the returned function does the writes. */
  private prepare(
    w: Write,
    m: SyncMutationInput,
  ): Promise<(tx: OrgTx) => Promise<Applied>> {
    const { at, skewed } = clampCapturedAt(m.capturedAt, w.now);
    const key = m.idempotencyKey;
    switch (m.type) {
      case 'attendance.mark':
        return this.attendance(w, m.payload, at, skewed, key);
      case 'memorization.log':
        return this.memorization(w, m.payload, at, skewed, key);
      case 'material.log':
        return this.materialLog(w, m.payload, at, skewed, key);
    }
  }

  private timezone(w: Pick<Write, 'org' | 'memo'>): Promise<string> {
    return once(w as Write, 'tz', () =>
      this.prisma.platform.organization
        .findUniqueOrThrow({
          where: { id: w.org.organizationId },
          select: { timezone: true },
        })
        .then((o) => o.timezone),
    );
  }

  private courseScope(w: Write, courseId: string): Promise<ClassScope> {
    return once(w, `scope:${courseId}`, () =>
      this.scope.forCourse(w.org, courseId, 'write'),
    );
  }

  private student(
    w: Write,
    scope: ClassScope,
    enrollmentId: string,
    materialId?: string,
  ) {
    return once(
      w,
      `student:${scope.course.id}:${enrollmentId}:${materialId ?? ''}`,
      () => this.scope.assertStudent(w.org, scope, enrollmentId, materialId),
    );
  }

  private row<T>(
    w: Write,
    key: string,
    load: () => Promise<T | null>,
    what: string,
  ): Promise<T> {
    return once(w, key, async () => {
      const found = await load();
      if (!found) throw notFound(what);
      return found;
    });
  }

  /** `at` is the clamped class time, so a sync the morning after still counts as the class day. */
  private async writableSession(w: Write, sessionId: string, at: Date) {
    const db = this.prisma.forOrganization(w.org.organizationId);
    const session = await this.row(
      w,
      `session:${sessionId}`,
      () => db.courseSession.findFirst({ where: { id: sessionId } }),
      'Session',
    );
    if (session.status === 'CANCELLED')
      throw conflict('This session was cancelled');
    const scope = await this.courseScope(w, session.courseId);
    if (
      !scope.staff &&
      !teacherMayWriteSession(at, session, await this.timezone(w))
    )
      throw forbidden('Teachers can change a class only on its day');
    return { session, scope };
  }

  /** The first record on a session marks it held; the cached row is updated so the batch does it once. */
  private async markHeld(tx: OrgTx, session: { id: string; status: string }) {
    if (session.status !== 'SCHEDULED') return;
    await tx.courseSession.updateMany({
      where: { id: session.id, status: 'SCHEDULED' },
      data: { status: 'HELD' },
    });
    session.status = 'HELD';
  }

  private teacherMemberId(org: OrgContext): string {
    if (!org.memberId) throw forbidden('Your account has no member profile');
    return org.memberId;
  }

  // -------------------------------------------------------------------------
  // attendance.mark — DM-09, last writer by markedAt wins
  // -------------------------------------------------------------------------

  private async attendance(
    w: Write,
    p: AttendanceMarkPayload,
    at: Date,
    skewed: boolean,
    key: string,
  ): Promise<(tx: OrgTx) => Promise<Applied>> {
    const marker = this.teacherMemberId(w.org);
    const { session, scope } = await this.writableSession(w, p.sessionId, at);
    await this.student(w, scope, p.enrollmentId);

    return async (tx) => {
      const existing = await tx.attendance.findFirst({
        where: { sessionId: p.sessionId, enrollmentId: p.enrollmentId },
      });
      const incoming = {
        status: p.status,
        markedByMemberId: marker,
        markedAt: at,
      };

      if (existing && !incomingAttendanceWins(existing.markedAt, at)) {
        // The losing value is kept in the audit log, never silently dropped (SYNC-13).
        await this.audit.record(
          w.audit,
          {
            action: 'attendance.superseded',
            entityType: 'attendance',
            entityId: existing.id,
            before: {
              ...incoming,
              idempotencyKey: key,
              clockSkew: skewed || undefined,
            },
            after: toAttendanceResponse(existing),
          },
          tx,
        );
        return {
          status: 'superseded',
          entityId: existing.id,
          server: toAttendanceResponse(existing),
        };
      }

      const data = { ...incoming, source: w.source, idempotencyKey: key };
      const row = existing
        ? await tx.attendance
            .updateManyAndReturn({
              where: { id: existing.id },
              data: { ...data, supersededCount: { increment: 1 } },
            })
            .then((rows) => rows[0])
        : await tx.attendance.create({
            data: {
              organizationId: w.org.organizationId,
              sessionId: p.sessionId,
              enrollmentId: p.enrollmentId,
              ...data,
            },
          });
      await this.markHeld(tx, session);

      await this.audit.record(
        w.audit,
        {
          action: existing ? 'attendance.corrected' : 'attendance.marked',
          entityType: 'attendance',
          entityId: row.id,
          before: existing ? toAttendanceResponse(existing) : undefined,
          after: {
            ...toAttendanceResponse(row),
            source: w.source,
            clockSkew: skewed || undefined,
          },
        },
        tx,
      );
      return { status: 'applied', entityId: row.id };
    };
  }

  // -------------------------------------------------------------------------
  // memorization.log — append-only, ranges → pages (ADR-0005)
  // -------------------------------------------------------------------------

  private async memorization(
    w: Write,
    p: MemorizationLogPayload,
    at: Date,
    skewed: boolean,
    key: string,
  ): Promise<(tx: OrgTx) => Promise<Applied>> {
    const loggedBy = this.teacherMemberId(w.org);
    const db = this.prisma.forOrganization(w.org.organizationId);
    const material = await this.material(w, p.materialId);
    await this.row(
      w,
      `member:${p.memberId}`,
      () => db.member.findFirst({ where: { id: p.memberId } }),
      'Member',
    );

    if (p.courseId) {
      const courseId = p.courseId;
      const scope = await this.courseScope(w, courseId);
      await this.assertCourseMaterial(w, courseId, p.materialId);
      const enrollment = await this.row(
        w,
        `enrollment:${courseId}:${p.memberId}`,
        () =>
          db.enrollment.findFirst({
            where: { courseId, memberId: p.memberId, status: 'ACTIVE' },
          }),
        'Enrollment',
      );
      await this.student(w, scope, enrollment.id, p.materialId);
    } else if (!isStaffContext(w.org)) {
      throw forbidden('Only staff record a starting level');
    }

    const span = resolveSpan(material.kind, material.totalPages, p);

    return async (tx) => {
      const row = await tx.memorizationLog.create({
        data: {
          organizationId: w.org.organizationId,
          memberId: p.memberId,
          materialId: p.materialId,
          courseId: p.courseId,
          type: p.type,
          ...span,
          grade: p.grade ?? null,
          mistakes: p.mistakes,
          note: p.note ?? null,
          loggedByMemberId: loggedBy,
          loggedAt: at,
          source: w.source,
          idempotencyKey: key,
        },
      });
      await writeSummary(tx, w.org.organizationId, p.memberId, p.materialId);
      await this.audit.record(
        w.audit,
        {
          action: 'memorization.logged',
          entityType: 'memorization_log',
          entityId: row.id,
          after: {
            memberId: row.memberId,
            materialId: row.materialId,
            courseId: row.courseId,
            type: row.type,
            pageFrom: row.pageFrom,
            pageTo: row.pageTo,
            source: w.source,
            clockSkew: skewed || undefined,
          },
        },
        tx,
      );
      return { status: 'applied', entityId: row.id };
    };
  }

  private material(w: Write, materialId: string) {
    const db = this.prisma.forOrganization(w.org.organizationId);
    return this.row(
      w,
      `material:${materialId}`,
      () => db.material.findFirst({ where: { id: materialId } }),
      'Material',
    );
  }

  private assertCourseMaterial(w: Write, courseId: string, materialId: string) {
    return once(w, `link:${courseId}:${materialId}`, async () => {
      const link = await this.prisma
        .forOrganization(w.org.organizationId)
        .courseMaterial.findFirst({ where: { courseId, materialId } });
      if (!link) throw conflict('This material is not part of the course');
    });
  }

  // -------------------------------------------------------------------------
  // material.log — explanation pages per class or group (decision 7.1)
  // -------------------------------------------------------------------------

  private async materialLog(
    w: Write,
    p: MaterialLogPayload,
    at: Date,
    skewed: boolean,
    key: string,
  ): Promise<(tx: OrgTx) => Promise<Applied>> {
    const loggedBy = this.teacherMemberId(w.org);
    const { session, scope } = await this.writableSession(w, p.sessionId, at);
    await this.assertCourseMaterial(w, session.courseId, p.materialId);
    const db = this.prisma.forOrganization(w.org.organizationId);
    const material = await this.material(w, p.materialId);
    if (material.totalPages && p.pageTo > material.totalPages)
      throw badRequest(
        'pageTo',
        `This material has ${material.totalPages} pages`,
      );

    const groupId = p.groupId ?? null;
    if (groupId) {
      const group = await db.courseGroup.findFirst({
        where: { id: groupId, courseId: session.courseId },
      });
      if (!group) throw notFound('Group');
      if (scope.groupIds && !scope.groupIds.includes(groupId))
        throw forbidden('This is not your group');
    } else if (scope.groupIds) {
      throw badRequest('groupId', 'Choose the group this class was for');
    }

    return async (tx) => {
      const row = await tx.materialLog.create({
        data: {
          organizationId: w.org.organizationId,
          sessionId: p.sessionId,
          materialId: p.materialId,
          groupId,
          pageFrom: p.pageFrom,
          pageTo: p.pageTo,
          note: p.note ?? null,
          loggedByMemberId: loggedBy,
          loggedAt: at,
          source: w.source,
          idempotencyKey: key,
        },
      });
      await this.markHeld(tx, session);
      await this.audit.record(
        w.audit,
        {
          action: 'material_log.created',
          entityType: 'material_log',
          entityId: row.id,
          after: {
            sessionId: row.sessionId,
            materialId: row.materialId,
            groupId,
            pageFrom: row.pageFrom,
            pageTo: row.pageTo,
            clockSkew: skewed || undefined,
          },
        },
        tx,
      );
      return { status: 'applied', entityId: row.id };
    };
  }

  // -------------------------------------------------------------------------
  // Online only: voids and tests
  // -------------------------------------------------------------------------

  /** DM-08: a void marks the row; it is never edited or deleted. Teachers: their own log, the same day. */
  async voidLog(
    org: OrgContext,
    audit: AuditContext,
    logId: string,
    reason: string,
    now = new Date(),
  ) {
    const db = this.prisma.forOrganization(org.organizationId);
    const log = await db.memorizationLog.findFirst({ where: { id: logId } });
    if (!log) throw notFound('Log');

    if (!isStaffContext(org)) {
      if (!log.courseId) throw forbidden();
      await this.scope.forCourse(org, log.courseId, 'write');
      const tz = await this.timezone({ org, memo: new Map() });
      if (
        log.loggedByMemberId !== org.memberId ||
        dateIn(log.loggedAt, tz) !== dateIn(now, tz)
      )
        throw forbidden(
          'Teachers can void only their own logs, on the same day',
        );
    }
    if (log.voidedAt) throw conflict('This log is already void');

    await db.$transaction(async (tx) => {
      await tx.memorizationLog.updateMany({
        where: { id: logId },
        data: {
          voidedAt: now,
          voidedByMemberId: org.memberId,
          voidReason: reason,
        },
      });
      await writeSummary(tx, org.organizationId, log.memberId, log.materialId);
      await this.audit.record(
        audit,
        {
          action: 'memorization.voided',
          entityType: 'memorization_log',
          entityId: logId,
          before: { voidedAt: null },
          after: { voidedAt: now.toISOString(), reason },
        },
        tx,
      );
    });
  }

  /** WF-07: every attempt is kept; `passed` uses the course's pass mark. */
  async recordTest(
    org: OrgContext,
    audit: AuditContext,
    input: CreateTestInput,
    now = new Date(),
  ): Promise<MemorizationTestResponse> {
    const examiner = this.teacherMemberId(org);
    const db = this.prisma.forOrganization(org.organizationId);
    const existing = await db.memorizationTest.findFirst({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return toTestResponse(existing);

    const [material, member] = await Promise.all([
      db.material.findFirst({ where: { id: input.materialId } }),
      db.member.findFirst({ where: { id: input.memberId } }),
    ]);
    if (!material) throw notFound('Material');
    if (!member) throw notFound('Member');

    let passMark = 60;
    if (input.courseId) {
      const scope: ClassScope = await this.scope.forCourse(
        org,
        input.courseId,
        'write',
      );
      const enrollment = await db.enrollment.findFirst({
        where: {
          courseId: input.courseId,
          memberId: input.memberId,
          status: 'ACTIVE',
        },
      });
      if (!enrollment) throw notFound('Enrollment');
      await this.scope.assertStudent(
        org,
        scope,
        enrollment.id,
        input.materialId,
      );
      passMark = scope.course.testPassMark;
    } else if (!isStaffContext(org)) {
      throw forbidden('Only staff record a test outside a course');
    }

    if (
      input.range &&
      material.kind === 'QURAN' &&
      !validateRange(toAyahRange(input.range))
    )
      throw badRequest('range', 'Not a valid ayah range');

    const scopeKey = {
      memberId: input.memberId,
      materialId: input.materialId,
      scopeType: input.scopeType,
      juz: input.juz ?? null,
      surahStart: input.range?.surahStart ?? null,
      ayahStart: input.range?.ayahStart ?? null,
      surahEnd: input.range?.surahEnd ?? null,
      ayahEnd: input.range?.ayahEnd ?? null,
      pageFrom: input.pageFrom ?? null,
      pageTo: input.pageTo ?? null,
    };
    const { at } = clampCapturedAt(input.takenAt, now);

    const row = await db.$transaction(async (tx) => {
      const attemptNo =
        (await tx.memorizationTest.count({ where: scopeKey })) + 1;
      const created = await tx.memorizationTest.create({
        data: {
          organizationId: org.organizationId,
          ...scopeKey,
          courseId: input.courseId,
          score: input.score,
          passMark,
          passed: input.score >= passMark,
          attemptNo,
          examinerMemberId: examiner,
          takenAt: at,
          notes: input.notes ?? null,
          idempotencyKey: input.idempotencyKey,
        },
      });
      await this.audit.record(
        audit,
        {
          action: 'test.recorded',
          entityType: 'memorization_test',
          entityId: created.id,
          after: {
            memberId: created.memberId,
            score: created.score,
            passed: created.passed,
            attemptNo,
          },
        },
        tx,
      );
      return created;
    });
    return toTestResponse(row);
  }
}

function toAyahRange(r: AyahRangeInput) {
  return {
    start: { surah: r.surahStart, ayah: r.ayahStart },
    end: { surah: r.surahEnd, ayah: r.ayahEnd },
  };
}

/** DM-11: the Quran is logged in ayahs and its pages are derived; other texts give pages. */
function resolveSpan(
  kind: MaterialKind,
  totalPages: number | null,
  p: MemorizationLogPayload,
) {
  if (kind === 'QURAN') {
    if (!p.range) throw badRequest('range', 'A Quran log needs an ayah range');
    const range = toAyahRange(p.range);
    if (!validateRange(range))
      throw badRequest('range', 'Not a valid ayah range');
    const pages = pagesForRange(range);
    return {
      ...p.range,
      pageFrom: pages.from,
      pageTo: pages.to,
      ayahCount: ayahsInRange(range),
    };
  }
  if (p.range || p.pageFrom === undefined || p.pageTo === undefined)
    throw badRequest('pageFrom', 'A text log needs a page range');
  if (totalPages && p.pageTo > totalPages)
    throw badRequest('pageTo', `This material has ${totalPages} pages`);
  return { pageFrom: p.pageFrom, pageTo: p.pageTo, ayahCount: null };
}

function duplicateOf(result: unknown): SyncResult {
  return { ...(result as SyncResult), status: 'duplicate' };
}

/** Mutations in one lane touch the same row or summary and must apply in the order sent. */
function laneOf(m: SyncMutationInput): string {
  switch (m.type) {
    case 'attendance.mark':
      return `attendance:${m.payload.sessionId}:${m.payload.enrollmentId}`;
    case 'memorization.log':
      return `summary:${m.payload.memberId}:${m.payload.materialId}`;
    case 'material.log':
      return `material:${m.idempotencyKey}`;
  }
}
