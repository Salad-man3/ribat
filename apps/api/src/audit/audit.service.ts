import { Injectable } from '@nestjs/common';
import type { AuditLog } from '@prisma/client';
import type { AuditLogResponse, CursorPaginationQuery } from '@ribat/shared';
import { PrismaService, type OrgTx } from '../prisma/prisma.service';
import type { AuditContext, AuditEventInput } from './audit-context';
import {
  collectAuditLookups,
  memberLabel,
  resolveAuditNames,
  type AuditNameMaps,
} from './audit-present';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Pass `tx` to write the audit row in the caller's transaction (SYNC-09). */
  async record(ctx: AuditContext, event: AuditEventInput, tx?: OrgTx): Promise<void> {
    const db = tx ?? this.prisma.forOrganization(ctx.organizationId);
    await db.auditLog.create({
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
    const maps = await this.loadNameMaps(organizationId, rows);
    return rows.map((row) => toAuditResponse(row, maps));
  }

  private async loadNameMaps(
    organizationId: string,
    rows: AuditLog[],
  ): Promise<AuditNameMaps> {
    const ids = collectAuditLookups(rows);
    const db = this.prisma.forOrganization(organizationId);

    const [
      actorMemberships,
      members,
      courses,
      programs,
      enrollments,
      materials,
    ] = await Promise.all([
      ids.membershipIds.length
        ? db.membership.findMany({
            where: { id: { in: ids.membershipIds } },
            include: { member: true },
          })
        : [],
      ids.memberIds.length
        ? db.member.findMany({ where: { id: { in: ids.memberIds } } })
        : [],
      ids.courseIds.length
        ? db.course.findMany({
            where: { id: { in: ids.courseIds } },
            select: { id: true, name: true },
          })
        : [],
      ids.programIds.length
        ? db.program.findMany({
            where: { id: { in: ids.programIds } },
            select: { id: true, name: true },
          })
        : [],
      ids.enrollmentIds.length
        ? db.enrollment.findMany({
            where: { id: { in: ids.enrollmentIds } },
            include: { member: true, course: true },
          })
        : [],
      ids.materialIds.length
        ? db.material.findMany({
            where: { id: { in: ids.materialIds } },
            select: { id: true, title: true },
          })
        : [],
    ]);

    const memberMap = new Map(members.map((m) => [m.id, memberLabel(m)]));
    const courseRows = [...courses];
    for (const e of enrollments) {
      memberMap.set(e.memberId, memberLabel(e.member));
      if (!courseRows.some((c) => c.id === e.courseId)) {
        courseRows.push({ id: e.courseId, name: e.course.name });
      }
    }

    return {
      actors: new Map(
        actorMemberships.flatMap((m) =>
          m.member ? ([[m.id, memberLabel(m.member)]] as const) : [],
        ),
      ),
      members: memberMap,
      courses: new Map(courseRows.map((c) => [c.id, c.name])),
      programs: new Map(programs.map((p) => [p.id, p.name])),
      materials: new Map(materials.map((m) => [m.id, m.title])),
    };
  }
}

function toAuditResponse(row: AuditLog, maps: AuditNameMaps): AuditLogResponse {
  const actorName = row.actorMembershipId
    ? (maps.actors.get(row.actorMembershipId) ?? null)
    : null;
  const { targetName, contextName } = resolveAuditNames(row, maps);
  return {
    id: row.id,
    organizationId: row.organizationId,
    actorIdentityId: row.actorIdentityId,
    actorMembershipId: row.actorMembershipId,
    actorName,
    targetName,
    contextName,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    before: row.before,
    after: row.after,
    requestId: row.requestId,
    createdAt: row.createdAt.toISOString(),
  };
}
