import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AssignableRole,
  CreateMembershipInput,
  ListMembershipsQuery,
  MembershipResponse,
  UpdateMembershipInput,
} from '@ribat/shared';
import type { AuditContext } from '../audit/audit-context';
import { AuditService } from '../audit/audit.service';
import type { OrgContext } from '../auth/org-context.guard';
import { IdentitiesService } from '../auth/identities.service';
import { SessionsService } from '../auth/sessions.service';
import { PrismaService } from '../prisma/prisma.service';
import { toMembershipResponse } from './membership.mapper';

function notFound(): NotFoundException {
  return new NotFoundException({
    error: { code: 'NOT_FOUND', message: 'Membership not found' },
  });
}

function forbidden(message = 'Forbidden'): ForbiddenException {
  return new ForbiddenException({
    error: { code: 'FORBIDDEN', message },
  });
}

@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identities: IdentitiesService,
    private readonly sessions: SessionsService,
    private readonly audit: AuditService,
  ) {}

  async list(organizationId: string, query: ListMembershipsQuery): Promise<MembershipResponse[]> {
    const rows = await this.prisma.forOrganization(organizationId).membership.findMany({
      where: {
        role: query.role,
        status: query.status,
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    return rows.map(toMembershipResponse);
  }

  async create(
    organizationId: string,
    actor: OrgContext,
    actorIdentityId: string,
    input: CreateMembershipInput,
    auditCtx: AuditContext,
  ): Promise<MembershipResponse> {
    await this.assertPassword(actorIdentityId, input.currentPassword);
    this.assertCanAssign(actor, input.role);

    const member = await this.prisma.forOrganization(organizationId).member.findFirst({
      where: { id: input.memberId, status: 'ACTIVE' },
    });
    if (!member?.phone) throw notFound();

    const identity = await this.identities.ensureIdentity(member.phone);
    const existing = await this.prisma.platform.membership.findUnique({
      where: {
        identityId_organizationId: {
          identityId: identity.id,
          organizationId,
        },
      },
    });
    if (existing) {
      throw new ConflictException({
        error: { code: 'CONFLICT', message: 'Membership already exists for this member' },
      });
    }

    const row = await this.prisma.forOrganization(organizationId).membership.create({
      data: {
        organizationId,
        identityId: identity.id,
        memberId: member.id,
        role: input.role,
        status: 'ACTIVE',
      },
    });

    await this.audit.record(auditCtx, {
      action: 'membership.created',
      entityType: 'membership',
      entityId: row.id,
      after: { role: row.role, status: row.status, memberId: row.memberId },
    });

    return toMembershipResponse(row);
  }

  async update(
    organizationId: string,
    id: string,
    actor: OrgContext,
    actorIdentityId: string,
    input: UpdateMembershipInput,
    auditCtx: AuditContext,
  ): Promise<MembershipResponse> {
    await this.assertPassword(actorIdentityId, input.currentPassword);

    const before = await this.prisma.forOrganization(organizationId).membership.findFirst({
      where: { id },
    });
    if (!before) throw notFound();

    if (before.role === 'SHEIKH') {
      throw forbidden('The sheikh membership cannot be changed');
    }

    if (input.role !== undefined) {
      this.assertCanAssign(actor, input.role);
    }
    if (
      (before.role === 'ORG_ADMIN' || input.role === 'ORG_ADMIN') &&
      actor.role !== 'SHEIKH'
    ) {
      throw forbidden();
    }

    const row = await this.prisma.forOrganization(organizationId).membership.updateMany({
      where: { id },
      data: {
        role: input.role,
        status: input.status,
      },
    });
    if (row.count === 0) throw notFound();

    const after = await this.prisma.forOrganization(organizationId).membership.findFirst({
      where: { id },
    });
    if (!after) throw notFound();

    if (input.status === 'SUSPENDED' && before.status === 'ACTIVE') {
      await this.sessions.revokeAllForIdentity(after.identityId);
    }

    await this.audit.record(auditCtx, {
      action: 'membership.updated',
      entityType: 'membership',
      entityId: after.id,
      before: { role: before.role, status: before.status },
      after: { role: after.role, status: after.status },
    });

    return toMembershipResponse(after);
  }

  async grantMemberAccess(
    organizationId: string,
    memberId: string,
    actor: OrgContext,
    actorIdentityId: string,
    role: AssignableRole,
    password: string,
    auditCtx: AuditContext,
  ) {
    await this.assertPassword(actorIdentityId, password);
    this.assertCanAssign(actor, role);

    const member = await this.prisma.forOrganization(organizationId).member.findFirst({
      where: { id: memberId, status: 'ACTIVE' },
    });
    if (!member?.phone) throw notFound();

    const ensured = await this.identities.ensureIdentity(member.phone);

    const membership = await this.prisma.platform.membership.upsert({
      where: {
        identityId_organizationId: {
          identityId: ensured.id,
          organizationId,
        },
      },
      create: {
        organizationId,
        identityId: ensured.id,
        memberId: member.id,
        role,
        status: 'ACTIVE',
      },
      update: {
        memberId: member.id,
        role,
        status: 'ACTIVE',
      },
    });

    const issued = await this.identities.issueSetupCode(ensured.id, actor.membershipId);

    await this.audit.record(auditCtx, {
      action: 'membership.access_granted',
      entityType: 'membership',
      entityId: membership.id,
      after: { role: membership.role, memberId: membership.memberId },
    });

    return {
      membershipId: membership.id,
      identityId: ensured.id,
      setupCode: issued.setupCode,
      expiresAt: issued.expiresAt,
    };
  }

  async resetMemberSetupCode(
    organizationId: string,
    memberId: string,
    actor: OrgContext,
    actorIdentityId: string,
    password: string,
    auditCtx: AuditContext,
  ) {
    await this.assertPassword(actorIdentityId, password);

    const membership = await this.prisma.forOrganization(organizationId).membership.findFirst({
      where: { memberId, status: 'ACTIVE' },
    });
    if (!membership) throw notFound();

    const issued = await this.identities.issueSetupCode(membership.identityId, actor.membershipId);

    await this.audit.record(auditCtx, {
      action: 'membership.setup_code_reset',
      entityType: 'membership',
      entityId: membership.id,
    });

    return {
      membershipId: membership.id,
      identityId: membership.identityId,
      setupCode: issued.setupCode,
      expiresAt: issued.expiresAt,
    };
  }

  private assertCanAssign(actor: OrgContext, role: AssignableRole): void {
    if (role === 'ORG_ADMIN' && actor.role !== 'SHEIKH') {
      throw forbidden();
    }
  }

  private async assertPassword(identityId: string, password: string): Promise<void> {
    const ok = await this.identities.passwordMatches(identityId, password);
    if (!ok) throw forbidden('Current password is incorrect');
  }
}
