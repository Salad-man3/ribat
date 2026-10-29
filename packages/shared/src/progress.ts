import { z } from 'zod';
import { SessionResponseSchema, wallTime } from './courses.js';
import { isoDate, isoDateTime, uuid } from './fields.js';
import { RecitationKindResponseSchema } from './hifz.js';

// ---------------------------------------------------------------------------
// S3: attendance, memorization, material logs, offline sync.
// The device validates with these same schemas before queueing (SYNC-07).
// ---------------------------------------------------------------------------

export const AttendanceStatusSchema = z.enum([
  'PRESENT',
  'ABSENT',
  'LATE',
  'EXCUSED',
]);
export type AttendanceStatus = z.infer<typeof AttendanceStatusSchema>;

export const MemorizationTypeSchema = z.enum(['NEW', 'REVISION', 'INITIAL', 'TEST']);
export type MemorizationType = z.infer<typeof MemorizationTypeSchema>;

export const GradeSchema = z.enum(['EXCELLENT', 'VERY_GOOD', 'GOOD', 'REPEAT']);
export type Grade = z.infer<typeof GradeSchema>;

export const TestScopeSchema = z.enum(['JUZ', 'SURAH', 'RANGE', 'TEXT_PAGES']);
export type TestScope = z.infer<typeof TestScopeSchema>;

/** Device time with its offset, e.g. 2026-09-18T15:04:11+03:00. */
export const capturedAt = z.string().datetime({ offset: true });

const page = z.number().int().positive().max(100_000);

/** Checked against the Quran dataset by the API and the range picker (DM-11). */
export const AyahRangeSchema = z.object({
  surahStart: z.number().int().min(1).max(114),
  ayahStart: z.number().int().min(1).max(286),
  surahEnd: z.number().int().min(1).max(114),
  ayahEnd: z.number().int().min(1).max(286),
});
export type AyahRangeInput = z.infer<typeof AyahRangeSchema>;

const pagesInOrder = (v: { pageFrom?: number; pageTo?: number }) =>
  v.pageFrom === undefined || v.pageTo === undefined || v.pageFrom <= v.pageTo;

export const AttendanceMarkPayloadSchema = z.object({
  sessionId: uuid,
  enrollmentId: uuid,
  status: AttendanceStatusSchema,
});
export type AttendanceMarkPayload = z.infer<typeof AttendanceMarkPayloadSchema>;

/** Quran logs carry an ayah `range`; texts carry `pageFrom`/`pageTo`. */
export const MemorizationLogPayloadSchema = z
  .object({
    memberId: uuid,
    materialId: uuid,
    courseId: uuid.nullable(),
    type: MemorizationTypeSchema,
    range: AyahRangeSchema.optional(),
    pageFrom: page.optional(),
    pageTo: page.optional(),
    grade: GradeSchema.nullable().optional(),
    mistakes: z.number().int().min(0).max(999).default(0),
    countsProgress: z.boolean().default(true),
    note: z.string().trim().max(1000).optional(),
    recitationKindId: uuid.optional(),
  })
  .refine(
    (v) =>
      v.range
        ? v.pageFrom === undefined
        : v.pageFrom !== undefined && v.pageTo !== undefined,
    {
      message: 'Give an ayah range or a page range, not both',
      path: ['range'],
    },
  )
  .refine(pagesInOrder, {
    message: 'pageTo must not be before pageFrom',
    path: ['pageTo'],
  })
  .refine((v) => (v.type === 'INITIAL') === (v.courseId === null), {
    message:
      'A starting-level (INITIAL) entry has no course; every other log has one',
    path: ['courseId'],
  });
export type MemorizationLogPayload = z.infer<
  typeof MemorizationLogPayloadSchema
>;

export const MaterialLogPayloadSchema = z
  .object({
    sessionId: uuid,
    materialId: uuid,
    groupId: uuid.nullable().optional(),
    pageFrom: page,
    pageTo: page,
    note: z.string().trim().max(1000).optional(),
  })
  .refine(pagesInOrder, {
    message: 'pageTo must not be before pageFrom',
    path: ['pageTo'],
  });
export type MaterialLogPayload = z.infer<typeof MaterialLogPayloadSchema>;

/** In-class juz test queued offline (WF-07, SC-B-11). */
export const MemorizationTestPayloadSchema = z.object({
  memberId: uuid,
  materialId: uuid,
  courseId: uuid,
  scopeType: z.literal('JUZ'),
  juz: z.number().int().min(1).max(30),
  score: z.number().int().min(0).max(100),
  notes: z.string().trim().max(1000).optional(),
});
export type MemorizationTestPayload = z.infer<
  typeof MemorizationTestPayloadSchema
>;

const mutationBase = { idempotencyKey: uuid, capturedAt };

export const SyncMutationSchema = z.discriminatedUnion('type', [
  z.object({
    ...mutationBase,
    type: z.literal('attendance.mark'),
    payload: AttendanceMarkPayloadSchema,
  }),
  z.object({
    ...mutationBase,
    type: z.literal('memorization.log'),
    payload: MemorizationLogPayloadSchema,
  }),
  z.object({
    ...mutationBase,
    type: z.literal('memorization.test'),
    payload: MemorizationTestPayloadSchema,
  }),
  z.object({
    ...mutationBase,
    type: z.literal('material.log'),
    payload: MaterialLogPayloadSchema,
  }),
]);
export type SyncMutationInput = z.infer<typeof SyncMutationSchema>;
export type SyncMutationType = SyncMutationInput['type'];

/** SYNC-12: a batch over the limit is rejected whole. */
export const SYNC_BATCH_LIMIT = 200;
export const SyncBatchSchema = z.object({
  mutations: z.array(SyncMutationSchema).min(1).max(SYNC_BATCH_LIMIT),
});
export type SyncBatchInput = z.infer<typeof SyncBatchSchema>;

export const SyncResultStatusSchema = z.enum([
  'applied',
  'duplicate',
  'superseded',
  'rejected',
]);
export type SyncResultStatus = z.infer<typeof SyncResultStatusSchema>;

export const SyncResultSchema = z.object({
  idempotencyKey: uuid,
  status: SyncResultStatusSchema,
  entityId: uuid.optional(),
  /** The winning row, for `superseded`. */
  server: z.record(z.unknown()).optional(),
  error: z.object({ code: z.string(), message: z.string() }).optional(),
});
export type SyncResult = z.infer<typeof SyncResultSchema>;

export const SyncResponseSchema = z.object({
  results: z.array(SyncResultSchema),
});
export type SyncResponse = z.infer<typeof SyncResponseSchema>;

// ---------------------------------------------------------------------------
// Online endpoints. Same payloads, same write path as replay.
// ---------------------------------------------------------------------------

export const PostAttendanceSchema = z.object({
  marks: z
    .array(
      z.object({
        idempotencyKey: uuid,
        capturedAt: capturedAt.optional(),
        enrollmentId: uuid,
        status: AttendanceStatusSchema,
      }),
    )
    .min(1)
    .max(SYNC_BATCH_LIMIT),
});
export type PostAttendanceInput = z.infer<typeof PostAttendanceSchema>;

const onlineKey = z.object({
  idempotencyKey: uuid,
  capturedAt: capturedAt.optional(),
});

export const CreateMemorizationLogSchema =
  MemorizationLogPayloadSchema.and(onlineKey);
export type CreateMemorizationLogInput = z.infer<
  typeof CreateMemorizationLogSchema
>;

export const CreateMaterialLogSchema = MaterialLogPayloadSchema.and(onlineKey);
export type CreateMaterialLogInput = z.infer<typeof CreateMaterialLogSchema>;

export const VoidLogSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});
export type VoidLogInput = z.infer<typeof VoidLogSchema>;

export const ListProgressQuerySchema = z.object({
  memberId: uuid.optional(),
  courseId: uuid.optional(),
  materialId: uuid.optional(),
  sessionId: uuid.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListProgressQuery = z.infer<typeof ListProgressQuerySchema>;

export const CreateTestSchema = z
  .object({
    idempotencyKey: uuid,
    memberId: uuid,
    materialId: uuid,
    courseId: uuid.nullable(),
    scopeType: TestScopeSchema,
    juz: z.number().int().min(1).max(30).optional(),
    range: AyahRangeSchema.optional(),
    pageFrom: page.optional(),
    pageTo: page.optional(),
    score: z.number().int().min(0).max(100),
    notes: z.string().trim().max(1000).optional(),
    takenAt: capturedAt.optional(),
  })
  .refine(
    (v) =>
      ({
        JUZ: v.juz !== undefined,
        SURAH: v.range !== undefined,
        RANGE: v.range !== undefined,
        TEXT_PAGES: v.pageFrom !== undefined && v.pageTo !== undefined,
      })[v.scopeType],
    { message: 'The scope needs its juz, range or pages', path: ['scopeType'] },
  )
  .refine(pagesInOrder, {
    message: 'pageTo must not be before pageFrom',
    path: ['pageTo'],
  });
export type CreateTestInput = z.infer<typeof CreateTestSchema>;

export const CreateSessionSchema = z
  .object({
    date: isoDate,
    startTime: wallTime,
    endTime: wallTime,
    topic: z.string().trim().max(200).optional(),
  })
  .refine((v) => v.startTime < v.endTime, {
    message: 'endTime must be after startTime',
    path: ['endTime'],
  });
export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;

export const UpdateSessionSchema = z
  .object({
    status: z.enum(['SCHEDULED', 'CANCELLED']).optional(),
    topic: z.string().trim().max(200).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to change' });
export type UpdateSessionInput = z.infer<typeof UpdateSessionSchema>;

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export const AttendanceResponseSchema = z.object({
  id: uuid,
  sessionId: uuid,
  enrollmentId: uuid,
  status: AttendanceStatusSchema,
  markedByMemberId: uuid,
  markedAt: isoDateTime,
  supersededCount: z.number().int(),
});
export type AttendanceResponse = z.infer<typeof AttendanceResponseSchema>;

export const RosterEntrySchema = z.object({
  enrollmentId: uuid,
  memberId: uuid,
  name: z.string(),
  attendance: AttendanceResponseSchema.nullable(),
});
export type RosterEntry = z.infer<typeof RosterEntrySchema>;

export const SessionAttendanceResponseSchema = z.object({
  session: SessionResponseSchema,
  roster: z.array(RosterEntrySchema),
});
export type SessionAttendanceResponse = z.infer<
  typeof SessionAttendanceResponseSchema
>;

export const MemorizationLogResponseSchema = z.object({
  id: uuid,
  memberId: uuid,
  materialId: uuid,
  courseId: uuid.nullable(),
  type: MemorizationTypeSchema,
  range: AyahRangeSchema.nullable(),
  pageFrom: z.number().int(),
  pageTo: z.number().int(),
  ayahCount: z.number().int().nullable(),
  grade: GradeSchema.nullable(),
  mistakes: z.number().int(),
  countsProgress: z.boolean(),
  note: z.string().nullable(),
  loggedByMemberId: uuid,
  loggedAt: isoDateTime,
  voidedAt: isoDateTime.nullable(),
  voidReason: z.string().nullable(),
});
export type MemorizationLogResponse = z.infer<
  typeof MemorizationLogResponseSchema
>;

export const MemorizationTestResponseSchema = z.object({
  id: uuid,
  memberId: uuid,
  materialId: uuid,
  courseId: uuid.nullable(),
  scopeType: TestScopeSchema,
  juz: z.number().int().nullable(),
  range: AyahRangeSchema.nullable(),
  pageFrom: z.number().int().nullable(),
  pageTo: z.number().int().nullable(),
  score: z.number().int(),
  passMark: z.number().int(),
  passed: z.boolean(),
  attemptNo: z.number().int(),
  examinerMemberId: uuid,
  takenAt: isoDateTime,
  notes: z.string().nullable(),
});
export type MemorizationTestResponse = z.infer<
  typeof MemorizationTestResponseSchema
>;

export const MaterialLogResponseSchema = z.object({
  id: uuid,
  sessionId: uuid,
  materialId: uuid,
  groupId: uuid.nullable(),
  pageFrom: z.number().int(),
  pageTo: z.number().int(),
  note: z.string().nullable(),
  loggedByMemberId: uuid,
  loggedAt: isoDateTime,
});
export type MaterialLogResponse = z.infer<typeof MaterialLogResponseSchema>;

export const MemorizationSummaryResponseSchema = z.object({
  memberId: uuid,
  materialId: uuid,
  pagesMemorized: z.number().int(),
  ayahsMemorized: z.number().int(),
  lastPageReached: z.number().int().nullable(),
  lastSurah: z.number().int().nullable(),
  lastAyah: z.number().int().nullable(),
  lastLoggedAt: isoDateTime.nullable(),
});
export type MemorizationSummaryResponse = z.infer<
  typeof MemorizationSummaryResponseSchema
>;

export const ClassKitTodayLogSchema = z.object({
  id: uuid,
  memberId: uuid,
  materialId: uuid,
  type: MemorizationTypeSchema,
  pageFrom: z.number().int(),
  pageTo: z.number().int(),
  countsProgress: z.boolean(),
  loggedAt: isoDateTime,
});
export type ClassKitTodayLog = z.infer<typeof ClassKitTodayLogSchema>;

export const ClassKitExplanationProgressSchema = z.object({
  sessionId: uuid,
  materialId: uuid,
  groupId: uuid.nullable(),
  pageTo: z.number().int(),
});
export type ClassKitExplanationProgress = z.infer<
  typeof ClassKitExplanationProgressSchema
>;

/** SYNC-02: everything class mode needs, and nothing the teacher may not see. */
export const ClassKitSchema = z.object({
  kitVersion: z.string(),
  generatedAt: isoDateTime,
  date: isoDate,
  timezone: z.string(),
  memberId: uuid,
  sessions: z.array(
    z.object({
      id: uuid,
      courseId: uuid,
      courseName: z.string(),
      courseType: z.enum(['MEMORIZATION', 'EXPLANATION', 'BOTH']),
      testPassMark: z.number().int(),
      date: isoDate,
      startsAt: isoDateTime,
      endsAt: isoDateTime,
      status: z.enum(['SCHEDULED', 'HELD', 'CANCELLED']),
      topic: z.string().nullable(),
      /** The teacher's groups in this course; empty when the course has no groups. */
      groupIds: z.array(uuid),
      roster: z.array(
        z.object({
          enrollmentId: uuid,
          memberId: uuid,
          name: z.string(),
          attendance: AttendanceStatusSchema.nullable(),
        }),
      ),
    }),
  ),
  materials: z.array(
    z.object({
      courseId: uuid,
      materialId: uuid,
      title: z.string(),
      kind: z.enum(['QURAN', 'TEXT', 'BOOK']),
      track: z.enum(['MEMORIZATION', 'EXPLANATION']),
      totalPages: z.number().int().nullable(),
    }),
  ),
  positions: z.array(MemorizationSummaryResponseSchema),
  /** Non-voided memorization logs for roster students on the kit date. */
  todayLogs: z.array(ClassKitTodayLogSchema),
  /** Furthest explanation page logged per session/material/group. */
  explanationProgress: z.array(ClassKitExplanationProgressSchema),
  recitationKinds: z.array(RecitationKindResponseSchema),
  /** Per-student juz coverage on the org Quran material (class roster strip). */
  memberHifzMaps: z.array(
    z.object({
      memberId: uuid,
      materialId: uuid,
      juzMemorized: z.array(z.number().int().min(1).max(30)),
    }),
  ),
});
export type ClassKit = z.infer<typeof ClassKitSchema>;

/** Staff/teacher course view: roster positions and who was logged today (online halaqa wall). */
export const CourseHalaqaWallSchema = z.object({
  date: isoDate,
  testPassMark: z.number().int(),
  explanation: z
    .object({
      materialId: uuid,
      title: z.string(),
      pageTo: z.number().int(),
      totalPages: z.number().int().nullable(),
    })
    .nullable(),
  students: z.array(
    z.object({
      memberId: uuid,
      name: z.string(),
      position: MemorizationSummaryResponseSchema.nullable(),
      loggedToday: z.boolean(),
      todayLogCount: z.number().int(),
      juzMemorized: z.array(z.number().int().min(1).max(30)).optional(),
    }),
  ),
});
export type CourseHalaqaWall = z.infer<typeof CourseHalaqaWallSchema>;
