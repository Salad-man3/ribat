import { z } from 'zod';
import { CursorPaginationQuerySchema } from './pagination.js';
import { e164Phone, isoDate, isoDateTime, requiredName, uuid } from './fields.js';

export const MemberStatusSchema = z.enum(['ACTIVE', 'ARCHIVED']);

export type MemberStatus = z.infer<typeof MemberStatusSchema>;

export const StudyStatusSchema = z.enum(['SCHOOL', 'UNIVERSITY', 'NOT_STUDYING']);
export type StudyStatus = z.infer<typeof StudyStatusSchema>;

export const EducationLevelSchema = z.enum([
  'NONE',
  'PRIMARY',
  'MIDDLE',
  'SECONDARY',
  'DIPLOMA',
  'BACHELOR',
  'MASTER',
  'DOCTORATE',
]);
export type EducationLevel = z.infer<typeof EducationLevelSchema>;

/** Levels at which a faculty or major is worth recording. */
export const LEVELS_WITH_FACULTY: readonly EducationLevel[] = [
  'DIPLOMA',
  'BACHELOR',
  'MASTER',
  'DOCTORATE',
];

const optionalText = z.string().trim().min(1).max(120).nullish();

export const CreateMemberSchema = z.object({
  firstName: requiredName,
  fatherName: requiredName,
  familyName: requiredName,
  motherName: z.string().trim().min(1).optional(),
  birthDate: isoDate,
  joinedAt: isoDate,
  phone: e164Phone.optional(),
  address: z.string().trim().min(1).optional(),
  schoolGrade: optionalText,
  schoolName: optionalText,
  studyStatus: StudyStatusSchema.nullish(),
  university: optionalText,
  faculty: optionalText,
  universityYear: z.number().int().min(1).max(8).nullish(),
  highestEducation: EducationLevelSchema.nullish(),
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
  studyStatus: StudyStatusSchema.nullable(),
  university: z.string().nullable(),
  faculty: z.string().nullable(),
  universityYear: z.number().int().nullable(),
  highestEducation: EducationLevelSchema.nullable(),
  joinedAt: isoDate,
  notes: z.string().nullable(),
  status: MemberStatusSchema,
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  archivedAt: isoDateTime.nullable(),
  siblingMemberIds: z.array(uuid).optional(),
});

export type MemberResponse = z.infer<typeof MemberResponseSchema>;