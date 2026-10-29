import type { Material } from '@prisma/client';
import type { MaterialResponse } from '@ribat/shared';
import { storedCustomValues } from '../custom-fields/stored-custom-values';

export function toMaterialResponse(row: Material): MaterialResponse {
  return {
    id: row.id,
    organizationId: row.organizationId,
    kind: row.kind,
    title: row.title,
    author: row.author,
    totalPages: row.totalPages,
    url: row.url,
    createdAt: row.createdAt.toISOString(),
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
    customValues: storedCustomValues(row.customValues),
  };
}
