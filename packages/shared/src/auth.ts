import { z } from 'zod';
import {
    currentPassword,
    deviceLabel,
    e164Phone,
    isoDateTime,
    newPassword,
    setupCode,
    uuid,
} from './fields.js';
import {
    MembershipRoleSchema,
    MembershipStatusSchema,
} from './people.js';

export const PlatformRoleSchema = z.enum(['OWNER', 'NONE']);
export const IdentityStatusSchema = z.enum(['ACTIVE', 'DISABLED']);

/** PERM-05. Absent when the caller is not staff. */
export const ActiveViewSchema = z.enum(['ADMIN', 'MEMBER']);
export type ActiveView = z.infer<typeof ActiveViewSchema>;

/**
 * S1 keys only. T108 decides who receives which key.
 * Later slices add keys; they do not rename these.
 */
export const S1PermissionSchema = z.enum([
    'members.manage',
    'memberships.manage',
    'memberships.manage_org_admin',
    'organization.manage',
    'notes.write',
    'notes.read_all',
    'audit.read',
    'courses.manage',
    'materials.manage',
]);
export type S1Permission = z.infer<typeof S1PermissionSchema>;

export const LoginSchema = z.object({
    phone: e164Phone,
    password: currentPassword,
    deviceLabel: deviceLabel.optional(),
});
export type LoginInput = z.infer<typeof LoginSchema>;

/** WF-02 step 4. The code is the proof; there is no existing password yet. */
export const RedeemSetupCodeSchema = z.object({
    phone: e164Phone,
    code: setupCode,
    password: newPassword,
    deviceLabel: deviceLabel.optional(),
});
export type RedeemSetupCodeInput = z.infer<typeof RedeemSetupCodeSchema>;

export const SwitchViewSchema = z.object({
    activeView: ActiveViewSchema,
});
export type SwitchViewInput = z.infer<typeof SwitchViewSchema>;

/**
 * Query strings are strings. `z.coerce.boolean()` is wrong here:
 * `Boolean("false")` is `true`. Only the literal `all=true` means
 * "sign out everywhere"; the path id is then ignored.
 */
export const RevokeDeviceQuerySchema = z.object({
    all: z.literal('true').optional(),
});
export type RevokeDeviceQuery = z.infer<typeof RevokeDeviceQuerySchema>;

export const MembershipSummarySchema = z.object({
    id: uuid,
    organizationId: uuid,
    organizationName: z.string(),
    role: MembershipRoleSchema,
    memberId: uuid.nullable(),
    status: MembershipStatusSchema,
});

export const MeResponseSchema = z.object({
    identity: z.object({
        id: uuid,
        phone: e164Phone,
        platformRole: PlatformRoleSchema,
        status: IdentityStatusSchema,
    }),
    memberships: z.array(MembershipSummarySchema),
    activeOrganizationId: uuid.nullable(),
    activeView: ActiveViewSchema.nullable(),
    permissions: z.array(S1PermissionSchema),
});
export type MeResponse = z.infer<typeof MeResponseSchema>;

/** Cookie is set by the server. The body is the same payload as GET /auth/me. */
export const LoginResponseSchema = MeResponseSchema;
export type LoginResponse = MeResponse;

export const DeviceResponseSchema = z.object({
    id: uuid,
    deviceLabel: z.string().nullable(),
    userAgent: z.string().nullable(),
    createdAt: isoDateTime,
    lastSeenAt: isoDateTime,
    expiresAt: isoDateTime,
    current: z.boolean(),
});
export type DeviceResponse = z.infer<typeof DeviceResponseSchema>;