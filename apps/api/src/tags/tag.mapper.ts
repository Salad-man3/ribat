import type { Tag } from '@prisma/client';
import { S1PermissionSchema, type TagResponse } from '@ribat/shared';

export function toTagResponse(row: Tag): TagResponse {
  const permissions = S1PermissionSchema.array().parse(row.permissions ?? []);
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    permissions,
    createdAt: row.createdAt.toISOString(),
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
  };
}
