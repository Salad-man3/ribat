import { type ZodError, type ZodSchema } from 'zod';
import type { ApiErrorBody } from './errors.js';

export type ValidationDetails = Record<string, string[]>;

export function zodErrorToDetails(error: ZodError): ValidationDetails {
  return error.flatten().fieldErrors as ValidationDetails;
}

export function formatValidationError(error: ZodError, requestId?: string): ApiErrorBody {
  const details = zodErrorToDetails(error);
  return {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details,
    },
    requestId,
  };
}

export function parseBody<T>(schema: ZodSchema<T>, value: unknown): T {
  return schema.parse(value);
}

export function safeParseBody<T>(
  schema: ZodSchema<T>,
  value: unknown,
): { success: true; data: T } | { success: false; error: ZodError } {
  const result = schema.safeParse(value);
  if (result.success) {
    return result;
  }
  return { success: false, error: result.error };
}
