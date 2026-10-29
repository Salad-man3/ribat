import type { JoinApplication } from '../generated/prisma/client.js';
import {
  JoinApplicationWardSchema,
  type JoinApplicationResponse,
} from '@ribat/shared';

export function toJoinApplicationResponse(row: JoinApplication): JoinApplicationResponse {
  const wards =
    row.wards === null || row.wards === undefined
      ? null
      : JoinApplicationWardSchema.array().parse(row.wards);
  return {
    id: row.id,
    organizationId: row.organizationId,
    kind: row.kind,
    status: row.status,
    phone: row.phone,
    firstName: row.firstName,
    fatherName: row.fatherName,
    familyName: row.familyName,
    birthDate: row.birthDate?.toISOString().slice(0, 10) ?? null,
    wards,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
