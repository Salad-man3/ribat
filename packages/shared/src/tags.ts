import { z } from 'zod';
import { isoDateTime, requiredName, uuid } from './fields.js';
import { AssignableStaffPermissionsSchema } from './permissions.js';
import { S1PermissionSchema } from './s1-permission.js';

export const TagResponseSchema = z.object({
  id: uuid,
  organizationId: uuid,
  name: z.string(),
  permissions: z.array(S1PermissionSchema),
  createdAt: isoDateTime,
  archivedAt: isoDateTime.nullable(),
});
export type TagResponse = z.infer<typeof TagResponseSchema>;

export const CreateTagSchema = z.object({
  name: requiredName,
  permissions: AssignableStaffPermissionsSchema.optional(),
});
export type CreateTagInput = z.infer<typeof CreateTagSchema>;

export const UpdateTagSchema = z
  .object({
    name: requiredName.optional(),
    permissions: AssignableStaffPermissionsSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });
export type UpdateTagInput = z.infer<typeof UpdateTagSchema>;
