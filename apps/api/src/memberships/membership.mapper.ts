import type { Membership } from '@prisma/client';
import type { MembershipResponse } from '@ribat/shared';
import { permissionsForMembershipContext } from '../auth/membership-permissions';
import type { Prisma } from '@prisma/client';

export type MembershipWithOrg = Membership & {
  organization?: { settings: Prisma.JsonValue };
  tagPermissionsJson?: unknown[];
};

export function toMembershipResponse(
  row: MembershipWithOrg,
  context?: {
    organizationSettings: Prisma.JsonValue;
    tagPermissionsJson: unknown[];
    activeView: 'ADMIN' | 'MEMBER';
  },
  memberTagIds?: string[],
): MembershipResponse {
  const organizationSettings =
    context?.organizationSettings ?? row.organization?.settings ?? {};
  const tagPermissionsJson = context?.tagPermissionsJson ?? row.tagPermissionsJson ?? [];
  const activeView = context?.activeView ?? 'ADMIN';

  return {
    id: row.id,
    organizationId: row.organizationId,
    identityId: row.identityId,
    memberId: row.memberId,
    role: row.role,
    status: row.status,
    permissions: permissionsForMembershipContext({
      role: row.role,
      activeView,
      organizationSettings,
      tagPermissionsJson,
    }),
    ...(memberTagIds !== undefined ? { memberTagIds } : {}),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const membershipInclude = {
  organization: { select: { settings: true } },
} as const;
