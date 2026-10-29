import { z } from 'zod';
import { CursorPaginationQuerySchema } from './pagination.js';

export const ListAuditQuerySchema = CursorPaginationQuerySchema;

export type ListAuditQuery = z.infer<typeof ListAuditQuerySchema>;

export const AuditLogResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  actorIdentityId: z.string().uuid().nullable(),
  actorMembershipId: z.string().uuid().nullable(),
  /** Display name of the staff account that performed the action, when known. */
  actorName: z.string().nullable(),
  /** Primary subject: halaqa, student, teacher, program, etc. */
  targetName: z.string().nullable(),
  /** Secondary context, often the halaqa name. */
  contextName: z.string().nullable(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().uuid(),
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  requestId: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export type AuditLogResponse = z.infer<typeof AuditLogResponseSchema>;
