import { z } from 'zod';
import { isoDate, isoDateTime, requiredName, uuid } from './fields.js';
import { PrayerMethodSchema } from './organization.js';

/** 24-hour wall-clock time in the organization's timezone. */
export const wallTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:mm');

// ---------------------------------------------------------------------------
// Prayer times (OQ-9)
// ---------------------------------------------------------------------------

export const PrayerTimesSchema = z.object({
  fajr: wallTime,
  sunrise: wallTime,
  dhuhr: wallTime,
  asr: wallTime,
  maghrib: wallTime,
  isha: wallTime,
});
export type PrayerTimes = z.infer<typeof PrayerTimesSchema>;

export const PrayerLookupQuerySchema = z.object({
  city: z.string().trim().min(2).max(100),
  country: z.string().trim().max(100).optional(),
  method: PrayerMethodSchema.default('MuslimWorldLeague'),
});
export type PrayerLookupQuery = z.infer<typeof PrayerLookupQuerySchema>;

/**
 * `reference` comes from the Aladhan API and is what the admin approves or edits;
 * `computed` is what Ribat itself calculates (the `adhan` library, offsets = 0).
 * Offsets to save = edited time - computed time.
 */
export const PrayerLookupResponseSchema = z.object({
  displayName: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string(),
  method: PrayerMethodSchema,
  date: isoDate,
  reference: PrayerTimesSchema,
  computed: PrayerTimesSchema,
});
export type PrayerLookupResponse = z.infer<typeof PrayerLookupResponseSchema>;

export const OrgPrayerTimesQuerySchema = z.object({ date: isoDate.optional() });
export type OrgPrayerTimesQuery = z.infer<typeof OrgPrayerTimesQuerySchema>;

export const OrgPrayerTimesResponseSchema = z.object({
  date: isoDate,
  timezone: z.string(),
  times: PrayerTimesSchema,
});
export type OrgPrayerTimesResponse = z.infer<
  typeof OrgPrayerTimesResponseSchema
>;

// ---------------------------------------------------------------------------
// Materials (T201)
// ---------------------------------------------------------------------------

export const MaterialKindSchema = z.enum(['QURAN', 'TEXT', 'BOOK']);
export type MaterialKind = z.infer<typeof MaterialKindSchema>;

export const MaterialTrackSchema = z.enum(['MEMORIZATION', 'EXPLANATION']);
export type MaterialTrack = z.infer<typeof MaterialTrackSchema>;

/** The Quran row is created by the system, one per organization. */
export const CreateMaterialSchema = z.object({
  kind: z.enum(['TEXT', 'BOOK']),
  title: requiredName,
  author: z.string().trim().min(1).optional(),
  totalPages: z.number().int().positive().max(100_000).optional(),
  url: z.string().trim().url().optional(),
});
export type CreateMaterialInput = z.infer<typeof CreateMaterialSchema>;

export const UpdateMaterialSchema = CreateMaterialSchema.omit({ kind: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });
export type UpdateMaterialInput = z.infer<typeof UpdateMaterialSchema>;

export const MaterialResponseSchema = z.object({
  id: uuid,
  organizationId: uuid,
  kind: MaterialKindSchema,
  title: z.string(),
  author: z.string().nullable(),
  totalPages: z.number().int().nullable(),
  url: z.string().nullable(),
  createdAt: isoDateTime,
  archivedAt: isoDateTime.nullable(),
});
export type MaterialResponse = z.infer<typeof MaterialResponseSchema>;

// ---------------------------------------------------------------------------
// Courses (T202, T205)
// ---------------------------------------------------------------------------

export const CourseTypeSchema = z.enum(['MEMORIZATION', 'EXPLANATION', 'BOTH']);
export type CourseType = z.infer<typeof CourseTypeSchema>;

export const CourseStatusSchema = z.enum([
  'DRAFT',
  'ACTIVE',
  'PAUSED',
  'FINISHED',
  'ARCHIVED',
]);
export type CourseStatus = z.infer<typeof CourseStatusSchema>;

/** OQ-1. FINISHED is read-only; ARCHIVED hides it from default lists. */
export const COURSE_TRANSITIONS: Record<CourseStatus, CourseStatus[]> = {
  DRAFT: ['ACTIVE'],
  ACTIVE: ['PAUSED', 'FINISHED'],
  PAUSED: ['ACTIVE', 'FINISHED'],
  FINISHED: ['ARCHIVED'],
  ARCHIVED: [],
};

const age = z.number().int().min(0).max(120);

const courseFields = z.object({
  name: requiredName,
  description: z.string().trim().min(1).optional(),
  type: CourseTypeSchema,
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  location: z.string().trim().min(1).optional(),
  minAge: age.optional(),
  maxAge: age.optional(),
  capacity: z.number().int().positive().max(10_000).optional(),
  testPassMark: z.number().int().min(0).max(100).optional(),
});

const datesInOrder = (value: { startDate?: string; endDate?: string }) =>
  !value.startDate || !value.endDate || value.startDate <= value.endDate;

export const CreateCourseSchema = courseFields.refine(datesInOrder, {
  message: 'endDate must not be before startDate',
  path: ['endDate'],
});
export type CreateCourseInput = z.infer<typeof CreateCourseSchema>;

export const UpdateCourseSchema = courseFields
  .partial()
  .extend({
    isHierarchical: z.boolean().optional(),
    hasGroups: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  })
  .refine(datesInOrder, {
    message: 'endDate must not be before startDate',
    path: ['endDate'],
  });
export type UpdateCourseInput = z.infer<typeof UpdateCourseSchema>;

export const ChangeCourseStatusSchema = z.object({
  status: CourseStatusSchema,
});
export type ChangeCourseStatusInput = z.infer<typeof ChangeCourseStatusSchema>;

export const ListCoursesQuerySchema = z.object({
  status: CourseStatusSchema.optional(),
  type: CourseTypeSchema.optional(),
});
export type ListCoursesQuery = z.infer<typeof ListCoursesQuerySchema>;

export const CourseResponseSchema = z.object({
  id: uuid,
  organizationId: uuid,
  name: z.string(),
  description: z.string().nullable(),
  type: CourseTypeSchema,
  status: CourseStatusSchema,
  startDate: isoDate.nullable(),
  endDate: isoDate.nullable(),
  location: z.string().nullable(),
  minAge: z.number().int().nullable(),
  maxAge: z.number().int().nullable(),
  capacity: z.number().int().nullable(),
  isHierarchical: z.boolean(),
  hasGroups: z.boolean(),
  testPassMark: z.number().int(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type CourseResponse = z.infer<typeof CourseResponseSchema>;

/** Attach a catalogue material, or create one and attach it (how teachers add materials, OQ-3). */
export const AddCourseMaterialSchema = z
  .object({
    materialId: uuid.optional(),
    newMaterial: CreateMaterialSchema.optional(),
    track: MaterialTrackSchema,
    order: z.number().int().min(0).optional(),
  })
  .refine(
    (value) =>
      (value.materialId === undefined) !== (value.newMaterial === undefined),
    {
      message: 'Send either materialId or newMaterial',
      path: ['materialId'],
    },
  );
export type AddCourseMaterialInput = z.infer<typeof AddCourseMaterialSchema>;

export const CourseMaterialResponseSchema = z.object({
  id: uuid,
  courseId: uuid,
  materialId: uuid,
  track: MaterialTrackSchema,
  order: z.number().int(),
  material: MaterialResponseSchema,
});
export type CourseMaterialResponse = z.infer<
  typeof CourseMaterialResponseSchema
>;

export const TeachingRoleSchema = z.enum(['LEAD', 'TEACHER']);
export type TeachingRole = z.infer<typeof TeachingRoleSchema>;

/** The first active teacher becomes LEAD; pass `role: 'LEAD'` to hand the lead over. */
export const AddTeacherSchema = z.object({
  memberId: uuid,
  role: TeachingRoleSchema.optional(),
});
export type AddTeacherInput = z.infer<typeof AddTeacherSchema>;

export const TeachingAssignmentResponseSchema = z.object({
  id: uuid,
  courseId: uuid,
  teacherMemberId: uuid,
  teacherName: z.string(),
  role: TeachingRoleSchema,
  createdAt: isoDateTime,
  endedAt: isoDateTime.nullable(),
});
export type TeachingAssignmentResponse = z.infer<
  typeof TeachingAssignmentResponseSchema
>;

/** GET /me/courses: courses the caller teaches, with their role. */
export const MyCourseResponseSchema = CourseResponseSchema.extend({
  teachingRole: TeachingRoleSchema,
});
export type MyCourseResponse = z.infer<typeof MyCourseResponseSchema>;

// ---------------------------------------------------------------------------
// Requirements and enrollment (T203, T204)
// ---------------------------------------------------------------------------

export const RequirementTypeSchema = z.enum([
  'MIN_AGE',
  'MAX_AGE',
  'COMPLETED_COURSE',
  'MANUAL',
]);
export type RequirementType = z.infer<typeof RequirementTypeSchema>;

export const CreateRequirementSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('MIN_AGE'),
    years: age,
    description: z.string().trim().min(1).optional(),
  }),
  z.object({
    type: z.literal('MAX_AGE'),
    years: age,
    description: z.string().trim().min(1).optional(),
  }),
  z.object({
    type: z.literal('COMPLETED_COURSE'),
    courseId: uuid,
    description: z.string().trim().min(1).optional(),
  }),
  z.object({
    type: z.literal('MANUAL'),
    description: z.string().trim().min(1).max(500),
  }),
]);
export type CreateRequirementInput = z.infer<typeof CreateRequirementSchema>;

export const RequirementResponseSchema = z.object({
  id: uuid,
  courseId: uuid,
  type: RequirementTypeSchema,
  years: z.number().int().nullable(),
  requiredCourseId: uuid.nullable(),
  description: z.string().nullable(),
});
export type RequirementResponse = z.infer<typeof RequirementResponseSchema>;

export const EnrollmentStatusSchema = z.enum([
  'ACTIVE',
  'WITHDRAWN',
  'COMPLETED',
]);
export type EnrollmentStatus = z.infer<typeof EnrollmentStatusSchema>;

export const EnrollSchema = z.object({ memberId: uuid });
export type EnrollInput = z.infer<typeof EnrollSchema>;

/** Decision 4.1: requirements warn, they never block staff. */
export const EnrollmentWarningSchema = z.object({
  code: z.enum([
    'MIN_AGE',
    'MAX_AGE',
    'COMPLETED_COURSE',
    'MANUAL',
    'CAPACITY',
  ]),
  message: z.string(),
});
export type EnrollmentWarning = z.infer<typeof EnrollmentWarningSchema>;

export const EnrollmentResponseSchema = z.object({
  id: uuid,
  courseId: uuid,
  memberId: uuid,
  memberName: z.string(),
  status: EnrollmentStatusSchema,
  startedAt: isoDate,
  endedAt: isoDate.nullable(),
});
export type EnrollmentResponse = z.infer<typeof EnrollmentResponseSchema>;

export const EnrollResultSchema = z.object({
  enrollment: EnrollmentResponseSchema,
  warnings: z.array(EnrollmentWarningSchema),
});
export type EnrollResult = z.infer<typeof EnrollResultSchema>;

// ---------------------------------------------------------------------------
// Groups (T206)
// ---------------------------------------------------------------------------

export const CreateGroupSchema = z.object({
  name: requiredName,
  teacherMemberId: uuid,
  /** Omit for a group that covers every material of the course. */
  materialId: uuid.optional(),
});
export type CreateGroupInput = z.infer<typeof CreateGroupSchema>;

export const UpdateGroupSchema = z
  .object({ name: requiredName.optional(), teacherMemberId: uuid.optional() })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });
export type UpdateGroupInput = z.infer<typeof UpdateGroupSchema>;

export const AddGroupStudentSchema = z.object({ enrollmentId: uuid });
export type AddGroupStudentInput = z.infer<typeof AddGroupStudentSchema>;

export const GroupResponseSchema = z.object({
  id: uuid,
  courseId: uuid,
  name: z.string(),
  teacherMemberId: uuid,
  teacherName: z.string(),
  materialId: uuid.nullable(),
  materialTitle: z.string().nullable(),
  enrollmentIds: z.array(uuid),
});
export type GroupResponse = z.infer<typeof GroupResponseSchema>;

// ---------------------------------------------------------------------------
// Schedule, pauses and sessions (T207–T209, T211)
// ---------------------------------------------------------------------------

export const PrayerSchema = z.enum([
  'FAJR',
  'SUNRISE',
  'DHUHR',
  'ASR',
  'MAGHRIB',
  'ISHA',
]);
export type Prayer = z.infer<typeof PrayerSchema>;

/** "From Asr to 18:00" = start {PRAYER, ASR, 0}, end {FIXED, 18:00}. */
export const TimePointSchema = z.discriminatedUnion('anchor', [
  z.object({ anchor: z.literal('FIXED'), time: wallTime }),
  z.object({
    anchor: z.literal('PRAYER'),
    prayer: PrayerSchema,
    offsetMin: z.number().int().min(-180).max(300).default(0),
  }),
]);
export type TimePoint = z.infer<typeof TimePointSchema>;

export const ScheduleRuleSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  start: TimePointSchema,
  end: TimePointSchema,
});
export type ScheduleRule = z.infer<typeof ScheduleRuleSchema>;

/** PUT replaces the active rules. Old rows are closed, not deleted. */
export const PutScheduleSchema = z.object({
  rules: z.array(ScheduleRuleSchema).max(14),
});
export type PutScheduleInput = z.infer<typeof PutScheduleSchema>;

export const ScheduleRuleResponseSchema = ScheduleRuleSchema.extend({
  id: uuid,
  effectiveFrom: isoDate,
  effectiveTo: isoDate.nullable(),
});
export type ScheduleRuleResponse = z.infer<typeof ScheduleRuleResponseSchema>;

export const CreatePauseSchema = z
  .object({
    fromDate: isoDate,
    toDate: isoDate,
    reason: z.string().trim().min(1).max(200).optional(),
  })
  .refine((value) => value.fromDate <= value.toDate, {
    message: 'toDate must not be before fromDate',
    path: ['toDate'],
  });
export type CreatePauseInput = z.infer<typeof CreatePauseSchema>;

export const PauseResponseSchema = z.object({
  id: uuid,
  courseId: uuid,
  fromDate: isoDate,
  toDate: isoDate,
  reason: z.string().nullable(),
});
export type PauseResponse = z.infer<typeof PauseResponseSchema>;

export const SessionStatusSchema = z.enum(['SCHEDULED', 'HELD', 'CANCELLED']);

export const ListSessionsQuerySchema = z
  .object({ from: isoDate.optional(), to: isoDate.optional() })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: 'to must not be before from',
    path: ['to'],
  });
export type ListSessionsQuery = z.infer<typeof ListSessionsQuerySchema>;

export const SessionResponseSchema = z.object({
  id: uuid,
  courseId: uuid,
  date: isoDate,
  startsAt: isoDateTime,
  endsAt: isoDateTime,
  status: SessionStatusSchema,
  topic: z.string().nullable(),
});
export type SessionResponse = z.infer<typeof SessionResponseSchema>;
