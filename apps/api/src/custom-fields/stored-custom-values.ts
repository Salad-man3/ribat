import type { CustomValues } from '@ribat/shared';

export function storedCustomValues(value: unknown): CustomValues {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: CustomValues = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (
      typeof raw === 'string' ||
      typeof raw === 'number' ||
      typeof raw === 'boolean'
    ) {
      out[key] = raw;
    }
  }
  return out;
}
