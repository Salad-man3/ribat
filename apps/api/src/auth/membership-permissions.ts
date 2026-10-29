import type { MembershipRole } from '@prisma/client';
import {
  permissionsFor,
  STAFF_ADMIN_PERMISSIONS,
  type ActiveView,
  type PermissionGrantOptions,
  type S1Permission,
} from '@ribat/shared';
import { S1PermissionSchema } from '@ribat/shared';
import {
  orgAdminPermissionsFromSettings,
  readOrganizationSettings,
} from '../organizations/organization.mapper';
import type { Prisma } from '@prisma/client';

export type PermissionContextInput = {
  role: MembershipRole;
  activeView: ActiveView;
  organizationSettings: Prisma.JsonValue;
  tagPermissionsJson: unknown[];
};

export function tagPermissionKeysFromRows(
  tagPermissionsJson: unknown[],
  tagsEnabled: boolean,
): S1Permission[] {
  if (!tagsEnabled) return [];
  const keys = new Set<S1Permission>();
  for (const raw of tagPermissionsJson) {
    const parsed = S1PermissionSchema.array().safeParse(raw);
    if (!parsed.success) continue;
    for (const key of parsed.data) {
      if (key !== 'memberships.manage_org_admin') {
        keys.add(key);
      }
    }
  }
  return [...keys];
}

export function permissionGrantOptionsFromContext(
  input: Omit<PermissionContextInput, 'activeView' | 'role'>,
): PermissionGrantOptions {
  const settings = readOrganizationSettings(input.organizationSettings);
  const tagsEnabled = settings.tagsEnabled ?? false;
  return {
    orgAdminPermissions: orgAdminPermissionsFromSettings(input.organizationSettings),
    tagPermissionKeys: tagPermissionKeysFromRows(input.tagPermissionsJson, tagsEnabled),
    tagsEnabled,
  };
}

export function permissionsForMembershipContext(
  input: PermissionContextInput,
): S1Permission[] {
  const options = permissionGrantOptionsFromContext(input);
  return permissionsFor(input.role, input.activeView, options);
}

export function orgAdminPermissionsForDisplay(settings: Prisma.JsonValue): S1Permission[] {
  const fromSettings = orgAdminPermissionsFromSettings(settings);
  return fromSettings ?? [...STAFF_ADMIN_PERMISSIONS];
}
