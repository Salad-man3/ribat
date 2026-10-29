import { z } from 'zod';

/** S1 keys only. T108 decides who receives which key. */
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
