import { z } from 'zod';
import { isoDate, isoDateTime, uuid } from './fields.js';

export const ReportCardStatusSchema = z.enum(['DRAFT', 'PUBLISHED']);
export type ReportCardStatus = z.infer<typeof ReportCardStatusSchema>;

export const ReportCardTestSummarySchema = z.object({
  testId: uuid,
  materialId: uuid,
  score: z.number().int(),
  passed: z.boolean(),
  takenAt: isoDateTime,
});
export type ReportCardTestSummary = z.infer<typeof ReportCardTestSummarySchema>;

export const ReportCardContentSchema = z.object({
  attendanceRate: z.number().nullable(),
  attendancePresent: z.number().int().nonnegative(),
  attendanceLate: z.number().int().nonnegative(),
  attendanceAbsent: z.number().int().nonnegative(),
  pagesMemorized: z.number().int().nonnegative(),
  tests: z.array(ReportCardTestSummarySchema),
  homeworkAssigned: z.number().int().nonnegative(),
  homeworkDone: z.number().int().nonnegative(),
});
export type ReportCardContent = z.infer<typeof ReportCardContentSchema>;

export const CreateReportCardSchema = z
  .object({
    memberId: uuid,
    courseId: uuid.nullable().optional(),
    periodStart: isoDate,
    periodEnd: isoDate,
  })
  .refine((v) => v.periodStart <= v.periodEnd, {
    message: 'periodEnd must not be before periodStart',
    path: ['periodEnd'],
  });
export type CreateReportCardInput = z.infer<typeof CreateReportCardSchema>;

export const UpdateReportCardCommentSchema = z.object({
  teacherComment: z.string().trim().max(2000).nullable(),
});
export type UpdateReportCardCommentInput = z.infer<typeof UpdateReportCardCommentSchema>;

export const ListReportCardsQuerySchema = z.object({
  status: ReportCardStatusSchema.optional(),
  memberId: uuid.optional(),
});
export type ListReportCardsQuery = z.infer<typeof ListReportCardsQuerySchema>;

export const ReportCardResponseSchema = z.object({
  id: uuid,
  memberId: uuid,
  memberName: z.string(),
  courseId: uuid.nullable(),
  courseName: z.string().nullable(),
  periodStart: isoDate,
  periodEnd: isoDate,
  content: ReportCardContentSchema,
  teacherComment: z.string().nullable(),
  status: ReportCardStatusSchema,
  publishedAt: isoDateTime.nullable(),
  createdAt: isoDateTime,
});
export type ReportCardResponse = z.infer<typeof ReportCardResponseSchema>;
