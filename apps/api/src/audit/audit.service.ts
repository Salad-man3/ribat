import { Injectable } from '@nestjs/common';
import type { AuditLog } from '@prisma/client';
import type { AuditLogResponse, CursorPaginationQuery } from '@ribat/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AuditContext, AuditEventInput } from './audit-context';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(ctx: AuditContext, event: AuditEventInput): Promise<void> {
    await this.prisma.forOrganization(ctx.organizationId).auditLog.create({
      data: {
        organizationId: ctx.organizationId,
        actorIdentityId: ctx.actorIdentityId,
        actorMembershipId: ctx.actorMembershipId,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        before: event.before ?? undefined,
        after: event.after ?? undefined,
        requestId: ctx.requestId ?? undefined,
      },
    });
  }

  async recordForIdentity(
    identityId: string,
    event: AuditEventInput,
    requestId?: string,
    actorMembershipId?: string | null,
  ): Promise<void> {
    const scope = await this.soleActiveMembership(identityId);
    if (!scope) return;
    await this.record(
      {
        organizationId: scope.organizationId,
        actorIdentityId: identityId,
        actorMembershipId: actorMembershipId ?? scope.membershipId,
        requestId,
      },
      event,
    );
  }

  async soleActiveMembership(
    identityId: string,
  ): Promise<{ organizationId: string; membershipId: string } | null> {
    const memberships = await this.prisma.platform.membership.findMany({
      where: {
        identityId,
        status: 'ACTIVE',
        organization: { status: 'ACTIVE' },
      },
      select: { id: true, organizationId: true },
    });
    if (memberships.length !== 1) return null;
    return { organizationId: memberships[0].organizationId, membershipId: memberships[0].id };
  }

  async list(organizationId: string, query: CursorPaginationQuery): Promise<AuditLogResponse[]> {
    const rows = await this.prisma.forOrganization(organizationId).auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      ...(query.cursor
        ? {
            cursor: { id: query.cursor },
            skip: 1,
          }
        : {}),
    });
    return rows.map(toAuditResponse);
  }
}

function toAuditResponse(row: AuditLog): AuditLogResponse {
  return {
    id: row.id,
    organizationId: row.organizationId,
    actorIdentityId: row.actorIdentityId,
    actorMembershipId: row.actorMembershipId,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    before: row.before,
    after: row.after,
    requestId: row.requestId,
    createdAt: row.createdAt.toISOString(),
  };
}
