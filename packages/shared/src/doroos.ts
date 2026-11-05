import { z } from 'zod';
import {
  CourseTypeSchema,
  SessionResponseSchema,
  wallTime,
} from './courses.js';
import { isoDate, uuid } from './fields.js';

export const CreateDoroosSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    type: CourseTypeSchema,
    date: isoDate,
    startTime: wallTime,
    endTime: wallTime,
    topic: z.string().trim().max(200).optional(),
    teacherMemberIds: z.array(uuid).min(1),
    memberIds: z.array(uuid).default([]),
    courseIds: z.array(uuid).default([]),
  })
  .refine((v) => v.startTime < v.endTime, {
    message: 'endTime must be after startTime',
    path: ['endTime'],
  });
export type CreateDoroosInput = z.infer<typeof CreateDoroosSchema>;

export const DoroosListItemSchema = SessionResponseSchema.extend({
  courseName: z.string(),
  kind: z.literal('ONE_OFF'),
});
export type DoroosListItem = z.infer<typeof DoroosListItemSchema>;

export const SessionConflictSchema = z.object({
  memberId: uuid,
  memberName: z.string(),
  courseId: uuid,
  courseName: z.string(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});
export type SessionConflict = z.infer<typeof SessionConflictSchema>;

export const PreviewSessionConflictsSchema = z.object({
  memberIds: z.array(uuid).min(1),
  windows: z
    .array(
      z.object({
        startsAt: z.string().datetime(),
        endsAt: z.string().datetime(),
      }),
    )
    .min(1),
  excludeCourseId: uuid.optional(),
});
export type PreviewSessionConflictsInput = z.infer<
  typeof PreviewSessionConflictsSchema
>;
