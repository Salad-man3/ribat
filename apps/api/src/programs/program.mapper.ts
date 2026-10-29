import type { Program } from '@prisma/client';
import type { ProgramResponse } from '@ribat/shared';
import { storedCustomValues } from '../custom-fields/stored-custom-values';
import { toDateString } from '../common/zoned-time';

export function toProgramResponse(row: Program): ProgramResponse {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    startDate: row.startDate ? toDateString(row.startDate) : null,
    endDate: row.endDate ? toDateString(row.endDate) : null,
    createdAt: row.createdAt.toISOString(),
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
    customValues: storedCustomValues(row.customValues),
  };
}
