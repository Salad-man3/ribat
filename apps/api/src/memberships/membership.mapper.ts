import type { Membership } from '@prisma/client';
import type { MembershipResponse } from '@ribat/shared';

export function toMembershipResponse(row: Membership): MembershipResponse {
  return {
    id: row.id,
    organizationId: row.organizationId,
    identityId: row.identityId,
    memberId: row.memberId,
    role: row.role,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
