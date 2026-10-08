import { Injectable, NotFoundException } from '@nestjs/common';
import type { HouseholdResponse, LinkSiblingInput } from '@ribat/shared';
import type { AuditContext } from '../audit/audit-context';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

function notFound(): NotFoundException {
  return new NotFoundException({
    error: { code: 'NOT_FOUND', message: 'Member not found' },
  });
}

@Injectable()
export class HouseholdsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async linkSibling(
    organizationId: string,
    memberId: string,
    input: LinkSiblingInput,
    auditCtx: AuditContext,
  ): Promise<HouseholdResponse> {
    const member = await this.prisma.forOrganization(organizationId).member.findFirst({
      where: { id: memberId, status: 'ACTIVE' },
    });
    const sibling = await this.prisma.forOrganization(organizationId).member.findFirst({
      where: { id: input.siblingMemberId, status: 'ACTIVE' },
    });
    if (!member || !sibling || member.id === sibling.id) throw notFound();

    const householdId = await this.resolveHouseholdId(organizationId, member, sibling);

    await this.prisma.forOrganization(organizationId).member.updateMany({
      where: { id: { in: [member.id, sibling.id] } },
      data: { householdId },
    });

    const members = await this.prisma.forOrganization(organizationId).member.findMany({
      where: { householdId, status: 'ACTIVE' },
      select: { id: true },
    });

    await this.audit.record(auditCtx, {
      action: 'household.linked',
      entityType: 'household',
      entityId: householdId,
      after: { memberIds: members.map((row) => row.id) },
    });

    const household = await this.prisma.forOrganization(organizationId).household.findFirst({
      where: { id: householdId },
    });
    if (!household) throw notFound();

    return {
      id: household.id,
      organizationId: household.organizationId,
      name: household.name,
      memberIds: members.map((row) => row.id),
    };
  }

  async siblingIds(organizationId: string, memberId: string, householdId: string | null): Promise<string[]> {
    if (!householdId) return [];
    const rows = await this.prisma.forOrganization(organizationId).member.findMany({
      where: { householdId, status: 'ACTIVE', id: { not: memberId } },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  private async resolveHouseholdId(
    organizationId: string,
    member: { id: string; householdId: string | null },
    sibling: { id: string; householdId: string | null },
  ): Promise<string> {
    const existing = member.householdId ?? sibling.householdId;
    if (existing) return existing;

    const created = await this.prisma.forOrganization(organizationId).household.create({
      data: { organizationId },
    });
    return created.id;
  }
}
