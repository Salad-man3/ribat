import { z } from 'zod';
import type { MembershipRole } from './people.js';
import type { ActiveView, S1Permission } from './auth.js';
import { S1PermissionSchema } from './s1-permission.js';

export const STAFF_ADMIN_PERMISSIONS: S1Permission[] = [
  'members.manage',
  'memberships.manage',
  'organization.manage',
  'notes.write',
  'notes.read_all',
  'audit.read',
  'courses.manage',
  'materials.manage',
];

/** Permissions the sheikh may assign to org-admin role or tags (PERM-01). */
export const ASSIGNABLE_STAFF_PERMISSIONS: S1Permission[] = STAFF_ADMIN_PERMISSIONS;

export type PermissionGrantOptions = {
  /** When null/undefined, ORG_ADMIN receives the full default staff set. */
  orgAdminPermissions?: S1Permission[] | null;
  tagPermissionKeys?: S1Permission[];
  tagsEnabled?: boolean;
};

function unionTagKeys(
  target: Set<S1Permission>,
  tagPermissionKeys: S1Permission[] | undefined,
  tagsEnabled: boolean | undefined,
): void {
  if (!tagsEnabled) return;
  for (const key of tagPermissionKeys ?? []) {
    if (key !== 'memberships.manage_org_admin') {
      target.add(key);
    }
  }
}

export function permissionsFor(
  role: MembershipRole,
  activeView: ActiveView,
  options: PermissionGrantOptions = {},
): S1Permission[] {
  if (activeView !== 'ADMIN') {
    return [];
  }
  if (role === 'SHEIKH') {
    return [...STAFF_ADMIN_PERMISSIONS, 'memberships.manage_org_admin'];
  }

  const keys = new Set<S1Permission>();

  if (role === 'ORG_ADMIN') {
    const orgAdmin =
      options.orgAdminPermissions === undefined || options.orgAdminPermissions === null
        ? STAFF_ADMIN_PERMISSIONS
        : options.orgAdminPermissions;
    for (const key of orgAdmin) {
      if (key !== 'memberships.manage_org_admin') {
        keys.add(key);
      }
    }
  }

  unionTagKeys(keys, options.tagPermissionKeys, options.tagsEnabled);

  return [...keys];
}

/** True when the membership may use admin view (at least one S1 key in ADMIN view). */
export function canUseAdminView(
  role: MembershipRole,
  options: PermissionGrantOptions = {},
): boolean {
  return permissionsFor(role, 'ADMIN', options).length > 0;
}

export const AssignableStaffPermissionsSchema = S1PermissionSchema.array().superRefine(
  (keys, ctx) => {
    if (keys.includes('memberships.manage_org_admin')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'memberships.manage_org_admin cannot be granted on a role or tag',
      });
    }
  },
);
