import type { Member } from '@prisma/client';
import type { OrgContext } from '../auth/org-context.guard';
import { shapeMember } from './member-shaping';

const member = {
  id: '11111111-1111-4111-8111-111111111111',
  organizationId: '22222222-2222-4222-8222-222222222222',
  householdId: null,
  firstName: 'A',
  fatherName: 'B',
  familyName: 'C',
  motherName: null,
  birthDate: new Date('2015-01-01'),
  phone: '+963900000000',
  address: 'secret',
  schoolGrade: null,
  schoolName: null,
  joinedAt: new Date('2024-01-01'),
  notes: 'private',
  status: 'ACTIVE',
  archivedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies Member;

describe('shapeMember', () => {
  it('hides private fields from guardians', () => {
    const org: OrgContext = {
      organizationId: member.organizationId,
      membershipId: '33333333-3333-4333-8333-333333333333',
      memberId: '44444444-4444-4444-8444-444444444444',
      role: 'GUARDIAN',
      activeView: null,
      permissions: [],
    };
    const shaped = shapeMember(member, org);
    expect(shaped.phone).toBeNull();
    expect(shaped.notes).toBeNull();
  });
});
