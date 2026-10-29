import { z } from 'zod';
import { isoDateTime, uuid } from './fields.js';

export const AwqafExamLevelSchema = z.enum([
  'AJZA_3',
  'AJZA_5',
  'AJZA_10',
  'AJZA_15',
  'KHATMAH',
]);
export type AwqafExamLevel = z.infer<typeof AwqafExamLevelSchema>;

export const AwqafExamJuzInputSchema = z.object({
  juz: z.number().int().min(1).max(30),
  passed: z.boolean(),
  score: z.number().int().min(0).max(100).nullable().optional(),
});
export type AwqafExamJuzInput = z.infer<typeof AwqafExamJuzInputSchema>;

export const CreateAwqafExamSchema = z.object({
  level: AwqafExamLevelSchema,
  takenAt: isoDateTime.optional(),
  notes: z.string().trim().max(1000).optional(),
  juzResults: z.array(AwqafExamJuzInputSchema).min(1).max(30),
});
export type CreateAwqafExamInput = z.infer<typeof CreateAwqafExamSchema>;

export const AwqafExamResponseSchema = z.object({
  id: uuid,
  memberId: uuid,
  level: AwqafExamLevelSchema,
  takenAt: isoDateTime,
  attemptNo: z.number().int(),
  notes: z.string().nullable(),
  recorderMemberId: uuid,
  juzResults: z.array(
    z.object({
      juz: z.number().int(),
      passed: z.boolean(),
      score: z.number().int().nullable(),
    }),
  ),
});
export type AwqafExamResponse = z.infer<typeof AwqafExamResponseSchema>;

export const CreateRecitationKindSchema = z.object({
  name: z.string().trim().min(1).max(80),
});
export type CreateRecitationKindInput = z.infer<
  typeof CreateRecitationKindSchema
>;

export const RecitationKindResponseSchema = z.object({
  id: uuid,
  name: z.string(),
  active: z.boolean(),
});
export type RecitationKindResponse = z.infer<
  typeof RecitationKindResponseSchema
>;
