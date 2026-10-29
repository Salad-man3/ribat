import { S1PermissionSchema, type S1Permission } from '@ribat/shared';

/** Assignable keys for org-admin role and tags (excludes sheikh-only memberships.manage_org_admin). */
export const STAFF_PERMISSION_OPTIONS: S1Permission[] =
  S1PermissionSchema.options.filter(
    (key) => key !== 'memberships.manage_org_admin',
  );

/** @deprecated Use STAFF_PERMISSION_OPTIONS */
export const STAFF_TEMPLATE_PERMISSION_OPTIONS = STAFF_PERMISSION_OPTIONS;
