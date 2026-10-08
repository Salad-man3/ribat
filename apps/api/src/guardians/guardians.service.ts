import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateGuardianLinkInput,
  GuardianLinkResponse,
  MemberResponse,
} from '@ribat/shared';
import type { AuditContext } from '../audit/audit-context';
import { AuditService } from '../audit/audit.service';
import { toMemberResponse } from '../members/member.mapper';
import { PrismaService } from '../prisma/prisma.service';

function notFound(): NotFoundException {
  return new NotFoundException({
    error: { code: 'NOT_FOUND', message: 'Member not found' },
  });
}

@Injectable()
export class GuardiansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(organizationId: string, wardMemberId: string): Promise<GuardianLinkResponse[]> {
    const ward = await this.prisma.forOrganization(organizationId).member.findFirst({
      where: { id: wardMemberId, status: 'ACTIVE' },
    });
    if (!ward) throw notFound();

    const rows = await this.prisma.forOrganization(organizationId).guardianLink.findMany({
      where: { wardMemberId },
    });
    return rows.map(toGuardianLinkResponse);
  }

  async create(
    organizationId: string,
    wardMemberId: string,
    input: CreateGuardianLinkInput,
    auditCtx: AuditContext,
  ): Promise<GuardianLinkResponse> {
    const ward = await this.prisma.forOrganization(organizationId).member.findFirst({
      where: { id: wardMemberId, status: 'ACTIVE' },
    });
    if (!ward) throw notFound();

    let guardianMemberId: string;
    if (input.mode === 'existing') {
      const guardian = await this.prisma.forOrganization(organizationId).member.findFirst({
        where: { id: input.guardianMemberId, status: 'ACTIVE' },
      });
      if (!guardian) throw notFound();
      guardianMemberId = guardian.id;
    } else {
      const created = await this.prisma.forOrganization(organizationId).member.create({
        data: {
          organizationId,
          firstName: input.guardian.firstName,
          fatherName: input.guardian.fatherName,
          familyName: input.guardian.familyName,
          birthDate: new Date('1985-01-01'),
          phone: input.guardian.phone ?? null,
          joinedAt: new Date(),
        },
      });
      guardianMemberId = created.id;
    }

    const row = await this.prisma.forOrganization(organizationId).guardianLink.create({
      data: {
        organizationId,
        guardianMemberId,
        wardMemberId,
        relation: input.relation,
        isPrimary: input.isPrimary,
      },
    });

    await this.audit.record(auditCtx, {
      action: 'guardian.linked',
      entityType: 'guardian_link',
      entityId: row.id,
      after: {
        guardianMemberId: row.guardianMemberId,
        wardMemberId: row.wardMemberId,
        relation: row.relation,
      },
    });

    return toGuardianLinkResponse(row);
  }

  async remove(
    organizationId: string,
    wardMemberId: string,
    linkId: string,
    auditCtx: AuditContext,
  ): Promise<void> {
    const deleted = await this.prisma.forOrganization(organizationId).guardianLink.deleteMany({
      where: { id: linkId, wardMemberId },
    });
    if (deleted.count === 0) throw notFound();

    await this.audit.record(auditCtx, {
      action: 'guardian.unlinked',
      entityType: 'guardian_link',
      entityId: linkId,
    });
  }

  async listWards(organizationId: string, guardianMemberId: string | null): Promise<MemberResponse[]> {
    if (!guardianMemberId) return [];
    const links = await this.prisma.forOrganization(organizationId).guardianLink.findMany({
      where: { guardianMemberId },
      select: { wardMemberId: true },
    });
    const wardIds = links.map((link) => link.wardMemberId);
    if (wardIds.length === 0) return [];

    const members = await this.prisma.forOrganization(organizationId).member.findMany({
      where: { id: { in: wardIds }, status: 'ACTIVE' },
    });
    return members.map(toMemberResponse);
  }

  async isWardOf(
    organizationId: string,
    guardianMemberId: string | null,
    wardMemberId: string,
  ): Promise<boolean> {
    if (!guardianMemberId) return false;
    const link = await this.prisma.forOrganization(organizationId).guardianLink.findFirst({
      where: { guardianMemberId, wardMemberId },
    });
    return link !== null;
  }
}

function toGuardianLinkResponse(row: {
  id: string;
  organizationId: string;
  guardianMemberId: string;
  wardMemberId: string;
  relation: GuardianLinkResponse['relation'];
  isPrimary: boolean;
}): GuardianLinkResponse {
  return {
    id: row.id,
    organizationId: row.organizationId,
    guardianMemberId: row.guardianMemberId,
    wardMemberId: row.wardMemberId,
    relation: row.relation,
    isPrimary: row.isPrimary,
  };
}
