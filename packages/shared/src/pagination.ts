import { z } from 'zod';

export const CursorPaginationQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type CursorPaginationQuery = z.infer<typeof CursorPaginationQuerySchema>;
