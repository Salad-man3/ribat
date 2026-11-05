import { z } from 'zod';

export const HealthStatusSchema = z.enum(['ok', 'error'] as const);

export type HealthStatus = z.infer<typeof HealthStatusSchema>;
