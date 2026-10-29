import { z } from 'zod';
import { isoDate, uuid } from './fields.js';

export const StatsScopeTypeSchema = z.enum(['ORG', 'COURSE', 'TEACHER', 'MEMBER']);
export type StatsScopeType = z.infer<typeof StatsScopeTypeSchema>;

/** Counters stored in StatsDaily.metrics; rates are derived when serving. */
export const StatsAttendanceCountersSchema = z.object({
  attendancePresent: z.number().int().nonnegative(),
  attendanceLate: z.number().int().nonnegative(),
  attendanceAbsent: z.number().int().nonnegative(),
});
export type StatsAttendanceCounters = z.infer<typeof StatsAttendanceCountersSchema>;

export const StatsProgressCountersSchema = z.object({
  pagesMemorized: z.number().int().nonnegative(),
  testsPassed: z.number().int().nonnegative(),
  testsTaken: z.number().int().nonnegative(),
});
export type StatsProgressCounters = z.infer<typeof StatsProgressCountersSchema>;

export const StatsOrgMetricsSchema = StatsAttendanceCountersSchema.merge(
  StatsProgressCountersSchema,
).extend({
  activeMembers: z.number().int().nonnegative(),
  activeCourses: z.number().int().nonnegative(),
  activeTeachers: z.number().int().nonnegative(),
  pendingJoinApplications: z.number().int().nonnegative(),
});
export type StatsOrgMetrics = z.infer<typeof StatsOrgMetricsSchema>;

export const StatsCourseMetricsSchema = StatsAttendanceCountersSchema.merge(
  StatsProgressCountersSchema,
).extend({
  sessionsHeld: z.number().int().nonnegative(),
  sessionsMissingAttendance: z.number().int().nonnegative(),
});
export type StatsCourseMetrics = z.infer<typeof StatsCourseMetricsSchema>;

export const StatsTeacherMetricsSchema = StatsAttendanceCountersSchema.merge(
  StatsProgressCountersSchema,
).extend({
  logged: z.boolean(),
});
export type StatsTeacherMetrics = z.infer<typeof StatsTeacherMetricsSchema>;

export const StatsMemberMetricsSchema = StatsAttendanceCountersSchema.merge(
  StatsProgressCountersSchema,
);
export type StatsMemberMetrics = z.infer<typeof StatsMemberMetricsSchema>;

export function attendanceRateFromCounters(
  counters: StatsAttendanceCounters,
): number | null {
  const total =
    counters.attendancePresent + counters.attendanceLate + counters.attendanceAbsent;
  if (total === 0) return null;
  return (counters.attendancePresent + counters.attendanceLate) / total;
}

export const StatsDailyRowSchema = z.object({
  date: isoDate,
  scopeType: StatsScopeTypeSchema,
  scopeId: uuid,
  metrics: z.record(z.unknown()),
});
export type StatsDailyRow = z.infer<typeof StatsDailyRowSchema>;

export const StatsCourseSeriesPointSchema = z.object({
  date: isoDate,
  attendanceRate: z.number().nullable(),
  pagesMemorized: z.number().int().nonnegative(),
  testsPassed: z.number().int().nonnegative(),
  testsTaken: z.number().int().nonnegative(),
});
export type StatsCourseSeriesPoint = z.infer<typeof StatsCourseSeriesPointSchema>;

export const StatsCourseResponseSchema = z.object({
  courseId: uuid,
  courseName: z.string(),
  programId: uuid.nullable(),
  programName: z.string().nullable(),
  from: isoDate,
  to: isoDate,
  asOf: isoDate,
  series: z.array(StatsCourseSeriesPointSchema),
  totals: StatsCourseMetricsSchema,
});
export type StatsCourseResponse = z.infer<typeof StatsCourseResponseSchema>;

export const StatsTeacherCourseSummarySchema = z.object({
  courseId: uuid,
  courseName: z.string(),
  attendanceRate: z.number().nullable(),
  pagesMemorized: z.number().int().nonnegative(),
  testsPassed: z.number().int().nonnegative(),
});
export type StatsTeacherCourseSummary = z.infer<typeof StatsTeacherCourseSummarySchema>;

export const StatsTeacherResponseSchema = z.object({
  teacherMemberId: uuid,
  teacherName: z.string(),
  from: isoDate,
  to: isoDate,
  asOf: isoDate,
  loggedDays: z.number().int().nonnegative(),
  courses: z.array(StatsTeacherCourseSummarySchema),
  totals: StatsTeacherMetricsSchema,
});
export type StatsTeacherResponse = z.infer<typeof StatsTeacherResponseSchema>;

export const StatsMemberSeriesPointSchema = StatsCourseSeriesPointSchema;
export type StatsMemberSeriesPoint = z.infer<typeof StatsMemberSeriesPointSchema>;

export const StatsMemberResponseSchema = z.object({
  memberId: uuid,
  memberName: z.string(),
  from: isoDate,
  to: isoDate,
  asOf: isoDate,
  series: z.array(StatsMemberSeriesPointSchema),
  totals: StatsMemberMetricsSchema,
});
export type StatsMemberResponse = z.infer<typeof StatsMemberResponseSchema>;

export const StatsDashboardCourseRowSchema = z.object({
  courseId: uuid,
  courseName: z.string(),
  programId: uuid.nullable(),
  programName: z.string().nullable(),
  attendanceRate: z.number().nullable(),
  pagesMemorized: z.number().int().nonnegative(),
  testsPassed: z.number().int().nonnegative(),
  sessionsMissingAttendance: z.number().int().nonnegative(),
});
export type StatsDashboardCourseRow = z.infer<typeof StatsDashboardCourseRowSchema>;

export const StatsDashboardTeacherRowSchema = z.object({
  teacherMemberId: uuid,
  teacherName: z.string(),
  attendanceRate: z.number().nullable(),
  pagesMemorized: z.number().int().nonnegative(),
  loggedThisWeek: z.boolean(),
});
export type StatsDashboardTeacherRow = z.infer<typeof StatsDashboardTeacherRowSchema>;

export const StatsTopMemberSchema = z.object({
  memberId: uuid,
  memberName: z.string(),
  pagesMemorized: z.number().int().nonnegative(),
});
export type StatsTopMember = z.infer<typeof StatsTopMemberSchema>;

export const StatsFallingBehindMemberSchema = z.object({
  memberId: uuid,
  memberName: z.string(),
  attendanceRate: z.number(),
  countableMarks: z.number().int().positive(),
});
export type StatsFallingBehindMember = z.infer<typeof StatsFallingBehindMemberSchema>;

export const StatsDashboardResponseSchema = z.object({
  from: isoDate,
  to: isoDate,
  asOf: isoDate,
  mosque: StatsOrgMetricsSchema,
  courses: z.array(StatsDashboardCourseRowSchema),
  teachers: z.array(StatsDashboardTeacherRowSchema),
  topMembers: z.array(StatsTopMemberSchema),
  fallingBehind: z.array(StatsFallingBehindMemberSchema),
});
export type StatsDashboardResponse = z.infer<typeof StatsDashboardResponseSchema>;

export const StatsDashboardQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(31).default(7),
});
export type StatsDashboardQuery = z.infer<typeof StatsDashboardQuerySchema>;
