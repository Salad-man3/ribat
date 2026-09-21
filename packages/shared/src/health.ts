import { z } from 'zod';

export const HealthStatusSchema = z.enum(['ok', 'error']);

export type HealthStatus = z.infer<typeof HealthStatusSchema>;
