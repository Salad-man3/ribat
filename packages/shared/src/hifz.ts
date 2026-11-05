import { z } from 'zod';
import { isoDateTime, uuid } from './fields.js';

export const AwqafExamLevelSchema = z.enum([
  'AJZA_1',
  'AJZA_3',
  'AJZA_5',
  'AJZA_10',
  'AJZA_15',
  'KHATMAH',
] as const);
export type AwqafExamLevel = z.infer<typeof AwqafExamLevelSchema>;

/** How many ajzaa must be covered by the juz range for this Awqaf sitting. */
export function awqafLevelJuzCount(level: AwqafExamLevel): number {
  switch (level) {
    case 'AJZA_1':
      return 1;
    case 'AJZA_3':
      return 3;
    case 'AJZA_5':
      return 5;
    case 'AJZA_10':
      return 10;
    case 'AJZA_15':
      return 15;
    case 'KHATMAH':
      return 30;
  }
}

export const CreateAwqafExamSchema = z
  .object({
    level: AwqafExamLevelSchema,
    juzFrom: z.number().int().min(1).max(30),
    juzTo: z.number().int().min(1).max(30),
    passed: z.boolean(),
    score: z.number().int().min(0).max(100).nullable().optional(),
    takenAt: isoDateTime.optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.juzFrom > v.juzTo) {
      ctx.addIssue({
        code: 'custom',
        message: 'juzFrom must not be greater than juzTo',
        path: ['juzFrom'],
      });
      return;
    }
    const span = v.juzTo - v.juzFrom + 1;
    const need = awqafLevelJuzCount(v.level);
    if (span !== need) {
      ctx.addIssue({
        code: 'custom',
        message: `This Awqaf level requires a range of exactly ${need} juz`,
        path: ['juzTo'],
      });
    }
  });
export type CreateAwqafExamInput = z.infer<typeof CreateAwqafExamSchema>;

export const AwqafExamResponseSchema = z.object({
  id: uuid,
  memberId: uuid,
  level: AwqafExamLevelSchema,
  juzFrom: z.number().int(),
  juzTo: z.number().int(),
  passed: z.boolean(),
  score: z.number().int().nullable(),
  takenAt: isoDateTime,
  attemptNo: z.number().int(),
  notes: z.string().nullable(),
  recorderMemberId: uuid,
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
