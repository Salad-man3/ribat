import { z } from 'zod';
import { isoDate, isoDateTime, uuid } from './fields.js';
import {
  AttendanceStatusSchema,
  MemorizationSummaryResponseSchema,
  MemorizationTestResponseSchema,
} from './progress.js';
import { NotificationCategoryCountsSchema, NotificationCategorySchema } from './notifications.js';

// ---------------------------------------------------------------------------
// S4: excuses, homework, the weekly timetable, member progress, notifications.
// ---------------------------------------------------------------------------

const dateRange = <T extends { fromDate: string; toDate: string }>(v: T) => v.fromDate <= v.toDate;

export const ExcuseStatusSchema = z.enum(['PENDING', 'ACCEPTED', 'REJECTED']);
export type ExcuseStatus = z.infer<typeof ExcuseStatusSchema>;

/** WF-08: a guardian (for a ward), a member (for themselves) or staff, before or after the absence. */
export const CreateExcuseSchema = z
  .object({
    memberId: uuid,
    courseId: uuid.nullable().default(null),
    fromDate: isoDate,
    toDate: isoDate,
    reason: z.string().trim().min(3).max(500),
  })
  .refine(dateRange, { message: 'toDate must not be before fromDate', path: ['toDate'] });
export type CreateExcuseInput = z.infer<typeof CreateExcuseSchema>;

export const DecideExcuseSchema = z.object({ decision: z.enum(['ACCEPTED', 'REJECTED']) });
export type DecideExcuseInput = z.infer<typeof DecideExcuseSchema>;

export const ListExcusesQuerySchema = z.object({ status: ExcuseStatusSchema.optional() });
export type ListExcusesQuery = z.infer<typeof ListExcusesQuerySchema>;

export const ExcuseResponseSchema = z.object({
  id: uuid,
  memberId: uuid,
  memberName: z.string(),
  courseId: uuid.nullable(),
  courseName: z.string().nullable(),
  fromDate: isoDate,
  toDate: isoDate,
  reason: z.string(),
  status: ExcuseStatusSchema,
  createdAt: isoDateTime,
  decidedAt: isoDateTime.nullable(),
});
export type ExcuseResponse = z.infer<typeof ExcuseResponseSchema>;

export const HomeworkTargetSchema = z.enum(['COURSE', 'GROUP', 'MEMBER']);
export type HomeworkTarget = z.infer<typeof HomeworkTargetSchema>;

export const HomeworkTaskStatusSchema = z.enum(['ASSIGNED', 'DONE', 'MISSED']);
export type HomeworkTaskStatus = z.infer<typeof HomeworkTaskStatusSchema>;

/** Decision 10.2. No points and no warnings are attached (decision 10.3). */
export const CreateHomeworkSchema = z
  .object({
    courseId: uuid,
    targetType: HomeworkTargetSchema,
    groupId: uuid.optional(),
    memberId: uuid.optional(),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional(),
    dueDate: isoDate,
  })
  .refine(
    (v) =>
      v.targetType === 'COURSE'
        ? !v.groupId && !v.memberId
        : v.targetType === 'GROUP'
          ? !!v.groupId && !v.memberId
          : !!v.memberId && !v.groupId,
    { message: 'Give the group or the member that matches the target', path: ['targetType'] },
  );
export type CreateHomeworkInput = z.infer<typeof CreateHomeworkSchema>;

export const ListHomeworkQuerySchema = z.object({ courseId: uuid });
export type ListHomeworkQuery = z.infer<typeof ListHomeworkQuerySchema>;

export const HomeworkResponseSchema = z.object({
  id: uuid,
  courseId: uuid,
  targetType: HomeworkTargetSchema,
  groupId: uuid.nullable(),
  memberId: uuid.nullable(),
  title: z.string(),
  description: z.string().nullable(),
  dueDate: isoDate,
  createdByMemberId: uuid,
  createdAt: isoDateTime,
  counts: z.object({ ASSIGNED: z.number().int(), DONE: z.number().int(), MISSED: z.number().int() }),
});
export type HomeworkResponse = z.infer<typeof HomeworkResponseSchema>;

export const HomeworkTaskResponseSchema = z.object({
  id: uuid,
  homeworkId: uuid,
  enrollmentId: uuid,
  memberId: uuid,
  memberName: z.string(),
  status: HomeworkTaskStatusSchema,
  markedAt: isoDateTime.nullable(),
});
export type HomeworkTaskResponse = z.infer<typeof HomeworkTaskResponseSchema>;

export const UpdateHomeworkTaskSchema = z.object({ status: HomeworkTaskStatusSchema });
export type UpdateHomeworkTaskInput = z.infer<typeof UpdateHomeworkTaskSchema>;

// Weekly timetable (decision 16.1–16.2)

export const ScheduleQuerySchema = z
  .object({ from: isoDate.optional(), to: isoDate.optional() })
  .refine((v) => !v.from || !v.to || v.from <= v.to, { message: 'to must not be before from', path: ['to'] });
export type ScheduleQuery = z.infer<typeof ScheduleQuerySchema>;

export const ScheduleEntrySchema = z.object({
  sessionId: uuid,
  courseId: uuid,
  courseName: z.string(),
  date: isoDate,
  startsAt: isoDateTime,
  endsAt: isoDateTime,
  status: z.enum(['SCHEDULED', 'HELD', 'CANCELLED']),
  topic: z.string().nullable(),
  /** Why this session is on the caller's timetable. */
  role: z.enum(['TEACHING', 'STUDYING', 'WARD']),
  memberId: uuid,
  memberName: z.string(),
});
export type ScheduleEntry = z.infer<typeof ScheduleEntrySchema>;

export const ScheduleResponseSchema = z.object({
  from: isoDate,
  to: isoDate,
  timezone: z.string(),
  entries: z.array(ScheduleEntrySchema),
});
export type ScheduleResponse = z.infer<typeof ScheduleResponseSchema>;

// Member progress — the card's numbers, for staff, the member and their guardians (PERM-07)

export const AttendanceCountsSchema = z.object({
  PRESENT: z.number().int(),
  ABSENT: z.number().int(),
  LATE: z.number().int(),
  EXCUSED: z.number().int(),
  total: z.number().int(),
  /** Present or late, over all marked sessions; null when nothing was marked. */
  rate: z.number().nullable(),
});
export type AttendanceCounts = z.infer<typeof AttendanceCountsSchema>;

export const MemberProgressResponseSchema = z.object({
  memberId: uuid,
  memberName: z.string(),
  courses: z.array(
    z.object({
      courseId: uuid,
      courseName: z.string(),
      enrollmentStatus: z.enum(['ACTIVE', 'WITHDRAWN', 'COMPLETED']),
      attendance: AttendanceCountsSchema,
    }),
  ),
  recentAttendance: z.array(
    z.object({ date: isoDate, courseName: z.string(), status: AttendanceStatusSchema }),
  ),
  summaries: z.array(
    MemorizationSummaryResponseSchema.extend({
      materialTitle: z.string(),
      materialKind: z.enum(['QURAN', 'TEXT', 'BOOK']),
    }),
  ),
  tests: z.array(MemorizationTestResponseSchema),
  homework: z.array(
    z.object({
      taskId: uuid,
      homeworkId: uuid,
      title: z.string(),
      description: z.string().nullable(),
      courseName: z.string(),
      dueDate: isoDate,
      status: HomeworkTaskStatusSchema,
    }),
  ),
  excuses: z.array(ExcuseResponseSchema),
  hifz: z
    .object({
      juzMemorized: z.array(z.number().int().min(1).max(30)),
      juzTests: z.array(
        z.object({
          juz: z.number().int().min(1).max(30),
          passed: z.boolean(),
          score: z.number().int(),
          attemptNo: z.number().int(),
        }),
      ),
      awqafByJuz: z.array(
        z.object({
          juz: z.number().int().min(1).max(30),
          passed: z.boolean(),
          score: z.number().int().nullable(),
          level: z.string(),
          takenAt: isoDateTime,
        }),
      ),
    })
    .nullable(),
});
export type MemberProgressResponse = z.infer<typeof MemberProgressResponseSchema>;

// Notifications (decision 15.x, SC-B-13)

export const NotificationTypeSchema = z.enum([
  'ABSENCE_SUMMARY',
  'ATTENDANCE_OVERRIDDEN',
  'TEST_RESULT',
  'HOMEWORK_ASSIGNED',
  'HOMEWORK_MISSED',
  'SCHEDULE_CHANGE',
  'EXCUSE_DECIDED',
  'SESSION_NOT_TAKEN',
  'ANNOUNCEMENT',
  'REPORT_CARD',
]);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

export const NotificationResponseSchema = z.object({
  id: uuid,
  type: NotificationTypeSchema,
  titleKey: z.string(),
  bodyKey: z.string(),
  params: z.record(z.unknown()),
  entityType: z.string().nullable(),
  entityId: uuid.nullable(),
  readAt: isoDateTime.nullable(),
  createdAt: isoDateTime,
});
export type NotificationResponse = z.infer<typeof NotificationResponseSchema>;

export const NotificationsResponseSchema = z.object({
  items: z.array(NotificationResponseSchema),
  unread: z.number().int(),
  unreadByCategory: NotificationCategoryCountsSchema,
});
export type NotificationsResponse = z.infer<typeof NotificationsResponseSchema>;

export const ListNotificationsQuerySchema = z.object({
  cursor: uuid.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  category: NotificationCategorySchema.optional(),
});
export type ListNotificationsQuery = z.infer<typeof ListNotificationsQuerySchema>;

export const MarkNotificationsReadSchema = z
  .object({ ids: z.array(uuid).max(200).optional(), all: z.literal(true).optional() })
  .refine((v) => !!v.all !== !!v.ids, { message: 'Send ids or all, not both' });
export type MarkNotificationsReadInput = z.infer<typeof MarkNotificationsReadSchema>;

// Failed event deliveries (T411)

export const FailedDeliveryResponseSchema = z.object({
  id: uuid,
  eventId: uuid,
  eventType: z.string(),
  handler: z.string(),
  status: z.enum(['FAILED', 'DEAD']),
  attempts: z.number().int(),
  lastError: z.string().nullable(),
  occurredAt: isoDateTime,
  requestId: z.string().nullable(),
});
export type FailedDeliveryResponse = z.infer<typeof FailedDeliveryResponseSchema>;
