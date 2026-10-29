import { z } from 'zod';
import { GuardianRelationSchema } from './people.js';
import { e164Phone, isoDate, isoDateTime, requiredName, uuid } from './fields.js';
import { SetupCodeResponseSchema } from './people.js';

export const JoinApplicationKindSchema = z.enum(['STUDENT', 'GUARDIAN']);
export type JoinApplicationKind = z.infer<typeof JoinApplicationKindSchema>;

export const JoinApplicationStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED']);
export type JoinApplicationStatus = z.infer<typeof JoinApplicationStatusSchema>;

export const JoinApplicationWardSchema = z.object({
  firstName: requiredName,
  fatherName: requiredName,
  familyName: requiredName,
  birthDate: isoDate,
  relation: GuardianRelationSchema,
});

export const CreateStudentJoinApplicationSchema = z.object({
  kind: z.literal('STUDENT'),
  phone: e164Phone,
  firstName: requiredName,
  fatherName: requiredName,
  familyName: requiredName,
  birthDate: isoDate,
});

export const CreateGuardianJoinApplicationSchema = z.object({
  kind: z.literal('GUARDIAN'),
  phone: e164Phone,
  firstName: requiredName,
  fatherName: requiredName,
  familyName: requiredName,
  wards: z.array(JoinApplicationWardSchema).min(1).max(12),
});

export const CreateJoinApplicationSchema = z.discriminatedUnion('kind', [
  CreateStudentJoinApplicationSchema,
  CreateGuardianJoinApplicationSchema,
]);
export type CreateJoinApplicationInput = z.infer<typeof CreateJoinApplicationSchema>;

export const ListJoinApplicationsQuerySchema = z.object({
  status: JoinApplicationStatusSchema.optional(),
});
export type ListJoinApplicationsQuery = z.infer<typeof ListJoinApplicationsQuerySchema>;

export const JoinApplicationResponseSchema = z.object({
  id: uuid,
  organizationId: uuid,
  kind: JoinApplicationKindSchema,
  status: JoinApplicationStatusSchema,
  phone: e164Phone,
  firstName: z.string(),
  fatherName: z.string(),
  familyName: z.string(),
  birthDate: isoDate.nullable(),
  wards: z.array(JoinApplicationWardSchema).nullable(),
  decidedAt: isoDateTime.nullable(),
  createdAt: isoDateTime,
});
export type JoinApplicationResponse = z.infer<typeof JoinApplicationResponseSchema>;

export const ApproveJoinApplicationResponseSchema = z.object({
  application: JoinApplicationResponseSchema,
  memberId: uuid,
  access: SetupCodeResponseSchema,
});
export type ApproveJoinApplicationResponse = z.infer<
  typeof ApproveJoinApplicationResponseSchema
>;

export const PublicJoinApplicationCreatedSchema = z.object({
  id: uuid,
});
export type PublicJoinApplicationCreated = z.infer<
  typeof PublicJoinApplicationCreatedSchema
>;

export const PublicOrganizationJoinInfoSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
});
export type PublicOrganizationJoinInfo = z.infer<typeof PublicOrganizationJoinInfoSchema>;

export const MemberAccessGapReasonSchema = z.enum(['NO_MEMBERSHIP', 'SETUP_PENDING']);
export type MemberAccessGapReason = z.infer<typeof MemberAccessGapReasonSchema>;

export const MemberAccessGapSchema = z.object({
  memberId: uuid,
  firstName: z.string(),
  fatherName: z.string(),
  familyName: z.string(),
  phone: e164Phone,
  reason: MemberAccessGapReasonSchema,
});
export type MemberAccessGap = z.infer<typeof MemberAccessGapSchema>;
