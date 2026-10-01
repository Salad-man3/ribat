import { z } from 'zod';
import { CursorPaginationQuerySchema } from './pagination.js';

export const MemberStatusSchema = z.enum(['ACTIVE', 'ARCHIVED']);

export type MemberStatus = z.infer<typeof MemberStatusSchema>;

const requiredName = z.string().trim().min(1, 'Required');

/** ISO 8601 calendar date (YYYY-MM-DD). */
const isoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be an ISO date (YYYY-MM-DD)');

const optionalPhone = z
  .string()
  .trim()
  .min(1)
  .regex(/^\+[1-9]\d{1,14}$/, 'Must be E.164 format')
  .optional();

export const CreateMemberSchema = z.object({
  firstName: requiredName,
  fatherName: requiredName,
  familyName: requiredName,
  motherName: z.string().trim().min(1).optional(),
  birthDate: isoDateString,
  joinedAt: isoDateString,
  phone: optionalPhone,
  address: z.string().trim().min(1).optional(),
  schoolGrade: z.string().trim().min(1).optional(),
  schoolName: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1).optional(),
  householdId: z.string().uuid().optional(),
});

export type CreateMemberInput = z.infer<typeof CreateMemberSchema>;

export const UpdateMemberSchema = CreateMemberSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'At least one field is required' },
);

export type UpdateMemberInput = z.infer<typeof UpdateMemberSchema>;

export const ListMembersQuerySchema = CursorPaginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  status: MemberStatusSchema.default('ACTIVE'),
});

export type ListMembersQuery = z.infer<typeof ListMembersQuerySchema>;

export const MemberResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  householdId: z.string().uuid().nullable(),
  firstName: z.string(),
  fatherName: z.string(),
  familyName: z.string(),
  motherName: z.string().nullable(),
  birthDate: z.string(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  schoolGrade: z.string().nullable(),
  schoolName: z.string().nullable(),
  joinedAt: z.string(),
  notes: z.string().nullable(),
  status: MemberStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().nullable(),
});

export type MemberResponse = z.infer<typeof MemberResponseSchema>;
