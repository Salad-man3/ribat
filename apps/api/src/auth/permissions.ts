export { canUseAdminView, permissionsFor } from '@ribat/shared';
import type { MembershipRole } from '@prisma/client';
import type { PermissionGrantOptions } from '@ribat/shared';
import { canUseAdminView as sharedCanUseAdminView } from '@ribat/shared';

const LEGACY_STAFF_ROLES = new Set<MembershipRole>(['SHEIKH', 'ORG_ADMIN']);

/** @deprecated Prefer checking effective permissions or canUseAdminView with grant options. */
export function isStaffRole(role: MembershipRole): boolean {
  return LEGACY_STAFF_ROLES.has(role);
}

export function canUseAdminViewForMembership(
  role: MembershipRole,
  options: PermissionGrantOptions,
): boolean {
  return sharedCanUseAdminView(role, options);
}
