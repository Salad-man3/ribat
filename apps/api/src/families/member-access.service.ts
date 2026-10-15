import { Injectable } from '@nestjs/common';
import type { Member } from '@prisma/client';
import type { OrgContext } from '../auth/org-context.guard';
import { forbidden, notFound } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { isStaffContext } from '../progress/class-scope.service';

export type MemberRelation = 'staff' | 'self' | 'guardian';

/**
 * DM-14 / PERM-07: who may read a member's schedule, attendance, progress and homework.
 * Staff in admin view, the member themselves, or a linked guardian. Never teacher notes.
 */
@Injectable()
export class MemberAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async relation(org: OrgContext, memberId: string): Promise<{ member: Member; relation: MemberRelation }> {
    const db = this.prisma.forOrganization(org.organizationId);
    const member = await db.member.findFirst({ where: { id: memberId } });
    if (!member) throw notFound('Member');
    if (isStaffContext(org)) return { member, relation: 'staff' };
    if (org.memberId === memberId) return { member, relation: 'self' };
    if (org.memberId) {
      const link = await db.guardianLink.findFirst({
        where: { guardianMemberId: org.memberId, wardMemberId: memberId },
      });
      if (link) return { member, relation: 'guardian' };
    }
    throw forbidden();
  }

  /** The caller's own member id plus their wards — whose excuses and timetables they follow. */
  async family(org: OrgContext): Promise<{ self: string | null; wards: string[] }> {
    if (!org.memberId) return { self: null, wards: [] };
    const links = await this.prisma
      .forOrganization(org.organizationId)
      .guardianLink.findMany({ where: { guardianMemberId: org.memberId }, select: { wardMemberId: true } });
    return { self: org.memberId, wards: links.map((l) => l.wardMemberId) };
  }
}
