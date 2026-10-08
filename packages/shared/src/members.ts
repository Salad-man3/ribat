import { z } from 'zod';
import { CursorPaginationQuerySchema } from './pagination.js';
import { e164Phone, isoDate, isoDateTime, requiredName, uuid } from './fields.js';

export const MemberStatusSchema = z.enum(['ACTIVE', 'ARCHIVED']);

export type MemberStatus = z.infer<typeof MemberStatusSchema>;

export const CreateMemberSchema = z.object({
  firstName: requiredName,
  fatherName: requiredName,
  familyName: requiredName,
  motherName: z.string().trim().min(1).optional(),
  birthDate: isoDate,
  joinedAt: isoDate,
  phone: e164Phone.optional(),
  address: z.string().trim().min(1).optional(),
  schoolGrade: z.string().trim().min(1).optional(),
  schoolName: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1).optional(),
  householdId: uuid.optional(),
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
  id: uuid,
  organizationId: uuid,
  householdId: uuid.nullable(),
  firstName: z.string(),
  fatherName: z.string(),
  familyName: z.string(),
  motherName: z.string().nullable(),
  birthDate: isoDate,
  phone: e164Phone.nullable(),
  address: z.string().nullable(),
  schoolGrade: z.string().nullable(),
  schoolName: z.string().nullable(),
  joinedAt: isoDate,
  notes: z.string().nullable(),
  status: MemberStatusSchema,
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  archivedAt: isoDateTime.nullable(),
});

export type MemberResponse = z.infer<typeof MemberResponseSchema>;