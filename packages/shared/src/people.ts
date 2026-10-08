import { z } from 'zod';
import { CursorPaginationQuerySchema } from './pagination.js';
import {
    currentPassword,
    e164Phone,
    isoDateTime,
    requiredName,
    setupCode,
    uuid,
} from './fields.js';

export const MembershipRoleSchema = z.enum([
    'SHEIKH',
    'ORG_ADMIN',
    'MEMBER',
    'GUARDIAN',
]);
export type MembershipRole = z.infer<typeof MembershipRoleSchema>;

/** WF-01 creates the only sheikh. Staff cannot assign that role later. */
export const AssignableRoleSchema = z.enum(['ORG_ADMIN', 'MEMBER', 'GUARDIAN']);
export type AssignableRole = z.infer<typeof AssignableRoleSchema>;

export const MembershipStatusSchema = z.enum(['ACTIVE', 'SUSPENDED']);
export type MembershipStatus = z.infer<typeof MembershipStatusSchema>;

export const GuardianRelationSchema = z.enum(['FATHER', 'MOTHER', 'OTHER']);
export type GuardianRelation = z.infer<typeof GuardianRelationSchema>;

export const MemberNoteVisibilitySchema = z.enum(['SHEIKH_ONLY', 'STAFF']);
export type MemberNoteVisibility = z.infer<typeof MemberNoteVisibilitySchema>;

const contactName = z.object({
    firstName: requiredName,
    fatherName: requiredName,
    familyName: requiredName,
    phone: e164Phone.optional(),
});

/** POST /members/:id/household. The ward is the path id. */
export const LinkSiblingSchema = z.object({
    siblingMemberId: uuid,
});
export type LinkSiblingInput = z.infer<typeof LinkSiblingSchema>;

export const HouseholdResponseSchema = z.object({
    id: uuid,
    organizationId: uuid,
    name: z.string().nullable(),
    memberIds: z.array(uuid),
});
export type HouseholdResponse = z.infer<typeof HouseholdResponseSchema>;

/**
 * POST /members/:id/guardians. `mode` is the discriminator so a payload
 * cannot both link an existing member and create a new one.
 */
export const CreateGuardianLinkSchema = z.discriminatedUnion('mode', [
    z.object({
        mode: z.literal('existing'),
        guardianMemberId: uuid,
        relation: GuardianRelationSchema,
        isPrimary: z.boolean().default(false),
    }),
    z.object({
        mode: z.literal('new'),
        guardian: contactName,
        relation: GuardianRelationSchema,
        isPrimary: z.boolean().default(false),
    }),
]);
export type CreateGuardianLinkInput = z.infer<typeof CreateGuardianLinkSchema>;

export const GuardianLinkResponseSchema = z.object({
    id: uuid,
    organizationId: uuid,
    guardianMemberId: uuid,
    wardMemberId: uuid,
    relation: GuardianRelationSchema,
    isPrimary: z.boolean(),
});
export type GuardianLinkResponse = z.infer<typeof GuardianLinkResponseSchema>;

export const CreateMemberNoteSchema = z.object({
    body: z.string().trim().min(1).max(5000),
    visibility: MemberNoteVisibilitySchema.default('SHEIKH_ONLY'),
    courseId: uuid.optional(),
});
export type CreateMemberNoteInput = z.infer<typeof CreateMemberNoteSchema>;

export const MemberNoteResponseSchema = z.object({
    id: uuid,
    organizationId: uuid,
    memberId: uuid,
    courseId: uuid.nullable(),
    authorMemberId: uuid,
    body: z.string(),
    visibility: MemberNoteVisibilitySchema,
    createdAt: isoDateTime,
});
export type MemberNoteResponse = z.infer<typeof MemberNoteResponseSchema>;

export const ListMembershipsQuerySchema = CursorPaginationQuerySchema.extend({
    role: MembershipRoleSchema.optional(),
    status: MembershipStatusSchema.optional(),
});
export type ListMembershipsQuery = z.infer<typeof ListMembershipsQuerySchema>;

export const CreateMembershipSchema = z.object({
    memberId: uuid,
    role: AssignableRoleSchema,
    currentPassword: currentPassword,
});
export type CreateMembershipInput = z.infer<typeof CreateMembershipSchema>;

export const UpdateMembershipSchema = z
    .object({
        role: AssignableRoleSchema.optional(),
        status: MembershipStatusSchema.optional(),
        currentPassword,
    })
    .refine((value) => value.role !== undefined || value.status !== undefined, {
        message: 'At least one field is required',
    });
export type UpdateMembershipInput = z.infer<typeof UpdateMembershipSchema>;

export const MembershipResponseSchema = z.object({
    id: uuid,
    organizationId: uuid,
    identityId: uuid,
    memberId: uuid.nullable(),
    role: MembershipRoleSchema,
    status: MembershipStatusSchema,
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
});
export type MembershipResponse = z.infer<typeof MembershipResponseSchema>;

/** POST /members/:id/access. Phone comes from the member row, not the body. */
export const GrantMemberAccessSchema = z.object({
    role: AssignableRoleSchema,
    currentPassword,
});
export type GrantMemberAccessInput = z.infer<typeof GrantMemberAccessSchema>;

export const ResetSetupCodeSchema = z.object({
    currentPassword,
});
export type ResetSetupCodeInput = z.infer<typeof ResetSetupCodeSchema>;

/** Plaintext code, returned once. Log the ids, never `setupCode`. */
export const SetupCodeResponseSchema = z.object({
    membershipId: uuid,
    identityId: uuid,
    setupCode,
    expiresAt: isoDateTime,
});
export type SetupCodeResponse = z.infer<typeof SetupCodeResponseSchema>;