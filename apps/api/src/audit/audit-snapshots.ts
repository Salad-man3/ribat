import type { Member } from '@prisma/client';

/** IDs and non-PII fields only — never names, phones, or addresses. */
export function memberAuditSnapshot(member: Member) {
  return {
    id: member.id,
    status: member.status,
    householdId: member.householdId,
  };
}

export function memberAuditDelta(
  before: Member,
  after: Member,
): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  const keys = ['status', 'householdId'] as const;
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const key of keys) {
    if (before[key] !== after[key]) {
      b[key] = before[key];
      a[key] = after[key];
    }
  }
  return Object.keys(b).length ? { before: b, after: a } : null;
}
