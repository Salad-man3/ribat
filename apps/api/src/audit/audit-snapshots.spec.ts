import type { Member } from '@prisma/client';
import { memberAuditDelta, memberAuditSnapshot } from './audit-snapshots';

const base = {
  id: '11111111-1111-4111-8111-111111111111',
  organizationId: '22222222-2222-4222-8222-222222222222',
  householdId: null,
  firstName: 'Secret',
  fatherName: 'Secret',
  familyName: 'Secret',
  motherName: null,
  birthDate: new Date('2015-01-01'),
  phone: '+963900000000',
  address: 'hidden',
  schoolGrade: null,
  schoolName: null,
  joinedAt: new Date('2024-01-01'),
  notes: 'private',
  status: 'ACTIVE',
  archivedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies Member;

describe('memberAuditSnapshot', () => {
  it('omits PII fields', () => {
    expect(memberAuditSnapshot(base)).toEqual({
      id: base.id,
      status: 'ACTIVE',
      householdId: null,
    });
  });
});

describe('memberAuditDelta', () => {
  it('returns null when nothing changed', () => {
    expect(memberAuditDelta(base, { ...base })).toBeNull();
  });

  it('records status changes only', () => {
    const after = { ...base, status: 'ARCHIVED' as const };
    expect(memberAuditDelta(base, after)).toEqual({
      before: { status: 'ACTIVE' },
      after: { status: 'ARCHIVED' },
    });
  });
});
