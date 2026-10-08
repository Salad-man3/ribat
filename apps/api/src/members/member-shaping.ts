import type { MemberResponse } from '@ribat/shared';
import type { OrgContext } from '../auth/org-context.guard';
import { isStaff } from '../auth/permissions';
import { toMemberResponse } from './member.mapper';
import type { Member } from '@prisma/client';

export function shapeMember(member: Member, org: OrgContext): MemberResponse {
  const base = toMemberResponse(member);
  if (isStaff(org.role) && org.activeView === 'ADMIN') {
    return base;
  }
  if (org.role === 'MEMBER' && org.memberId === member.id) {
    return { ...base, notes: null };
  }
  return {
    ...base,
    phone: null,
    address: null,
    schoolGrade: null,
    schoolName: null,
    notes: null,
  };
}
