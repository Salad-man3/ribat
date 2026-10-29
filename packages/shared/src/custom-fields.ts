import { z } from 'zod';
import { isoDate, isoDateTime, requiredName, uuid } from './fields.js';

export const CustomFieldEntityTypeSchema = z.enum([
  'MEMBER',
  'COURSE',
  'PROGRAM',
  'MATERIAL',
]);
export type CustomFieldEntityType = z.infer<typeof CustomFieldEntityTypeSchema>;

export const CustomFieldTypeSchema = z.enum(['TEXT', 'NUMBER', 'DATE', 'BOOLEAN']);
export type CustomFieldType = z.infer<typeof CustomFieldTypeSchema>;

export const CustomFieldDefinitionResponseSchema = z.object({
  id: uuid,
  organizationId: uuid,
  entityType: CustomFieldEntityTypeSchema,
  key: z.string(),
  label: z.string(),
  type: CustomFieldTypeSchema,
  createdAt: isoDateTime,
  archivedAt: isoDateTime.nullable(),
});
export type CustomFieldDefinitionResponse = z.infer<
  typeof CustomFieldDefinitionResponseSchema
>;

export const ListCustomFieldsQuerySchema = z.object({
  entityType: CustomFieldEntityTypeSchema.optional(),
});
export type ListCustomFieldsQuery = z.infer<typeof ListCustomFieldsQuerySchema>;

export const CreateCustomFieldSchema = z.object({
  entityType: CustomFieldEntityTypeSchema,
  label: requiredName,
  type: CustomFieldTypeSchema,
});
export type CreateCustomFieldInput = z.infer<typeof CreateCustomFieldSchema>;

export const UpdateCustomFieldSchema = z.object({
  label: requiredName,
});
export type UpdateCustomFieldInput = z.infer<typeof UpdateCustomFieldSchema>;

export const CustomValuesInputSchema = z.record(z.unknown()).optional();
export type CustomValuesInput = z.infer<typeof CustomValuesInputSchema>;

export const CustomValuesSchema = z.record(
  z.union([z.string(), z.number(), z.boolean()]),
);
export type CustomValues = z.infer<typeof CustomValuesSchema>;

type Def = Pick<CustomFieldDefinitionResponse, 'key' | 'type'>;

function coerceValue(type: CustomFieldType, value: unknown): string | number | boolean | null {
  if (value === null || value === undefined || value === '') return null;
  switch (type) {
    case 'TEXT':
      return typeof value === 'string' && value.trim() ? value.trim() : null;
    case 'NUMBER': {
      const n = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(n) ? n : null;
    }
    case 'DATE':
      return typeof value === 'string' && isoDate.safeParse(value).success
        ? value
        : null;
    case 'BOOLEAN':
      if (typeof value === 'boolean') return value;
      if (value === 'true') return true;
      if (value === 'false') return false;
      return null;
    default:
      return null;
  }
}

/** Keeps only keys with active definitions; drops unknown keys and invalid types. */
export function sanitizeCustomValues(
  definitions: Def[],
  input: unknown,
): CustomValues {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const raw = input as Record<string, unknown>;
  const byKey = new Map(definitions.map((d) => [d.key, d.type]));
  const out: CustomValues = {};
  for (const [key, value] of Object.entries(raw)) {
    const type = byKey.get(key);
    if (!type) continue;
    const coerced = coerceValue(type, value);
    if (coerced !== null) out[key] = coerced;
  }
  return out;
}

export function mergeCustomValues(
  existing: CustomValues,
  patch: CustomValues,
): CustomValues {
  return { ...existing, ...patch };
}

/** Slug for storage; server may append a suffix on collision. */
export function customFieldKeyFromLabel(label: string): string {
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .slice(0, 48);
  return normalized || 'field';
}
