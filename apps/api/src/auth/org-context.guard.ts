import {
    applyDecorators,
    CanActivate,
    createParamDecorator,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    SetMetadata,
    UseGuards,
} from '@nestjs/common';
import type { MembershipRole } from '@prisma/client';
import type { ActiveView, S1Permission } from '@ribat/shared';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import { auditContextFromOrg, requestIdFrom, type AuditContext } from '../audit/audit-context';
import { PrismaService } from '../prisma/prisma.service';
import { permissionsForMembershipContext } from './membership-permissions';
import { SessionGuard } from './session.guard';
import type { SessionContext } from './sessions.service';

export const REQUIRED_PERMISSIONS = 'requiredPermissions';

export type OrgContext = {
    organizationId: string;
    membershipId: string;
    memberId: string | null;
    role: MembershipRole;
    activeView: ActiveView | null;
    permissions: S1Permission[];
};

function forbidden(message = 'Forbidden'): ForbiddenException {
    return new ForbiddenException({
        error: { code: 'FORBIDDEN', message },
    });
}

@Injectable()
export class OrgContextGuard implements CanActivate {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest<
            Request & { auth?: SessionContext; org?: OrgContext }
        >();
        const session = req.auth;
        if (!session) {
            throw forbidden('Sign in required');
        }

        const memberships = await this.prisma.platform.membership.findMany({
            where: {
                identityId: session.identityId,
                status: 'ACTIVE',
                organization: { status: 'ACTIVE' },
            },
            select: {
                id: true,
                organizationId: true,
                memberId: true,
                role: true,
                organization: { select: { settings: true } },
            },
        });

        if (memberships.length !== 1) {
            throw forbidden('No active organization context');
        }

        const membership = memberships[0];
        const tagPermissionsJson =
            membership.memberId === null
                ? []
                : (
                      await this.prisma.platform.memberTag.findMany({
                          where: {
                              memberId: membership.memberId,
                              organizationId: membership.organizationId,
                          },
                          select: { tag: { select: { permissions: true } } },
                      })
                  ).map((row) => row.tag.permissions);

        const viewForPerms = session.activeView;
        const permissions = permissionsForMembershipContext({
            role: membership.role,
            activeView: viewForPerms,
            organizationSettings: membership.organization.settings,
            tagPermissionsJson,
        });

        const canUseAdminView = permissionsForMembershipContext({
            role: membership.role,
            activeView: 'ADMIN',
            organizationSettings: membership.organization.settings,
            tagPermissionsJson,
        }).length > 0;

        req.org = {
            organizationId: membership.organizationId,
            membershipId: membership.id,
            memberId: membership.memberId,
            role: membership.role,
            activeView: canUseAdminView ? session.activeView : null,
            permissions,
        };

        const required =
            Reflect.getMetadata(REQUIRED_PERMISSIONS, context.getHandler()) ??
            Reflect.getMetadata(REQUIRED_PERMISSIONS, context.getClass());

        if (required?.length) {
            const missing = (required as S1Permission[]).some(
                (key) => !permissions.includes(key),
            );
            if (missing) {
                await this.audit.record(
                    auditContextFromOrg(req.org, session.identityId, requestIdFrom(req)),
                    {
                        action: 'auth.permission_denied',
                        entityType: 'membership',
                        entityId: membership.id,
                        after: { required },
                    },
                );
                throw forbidden();
            }
        }

        return true;
    }
}

export const OrgRoute = (...permissions: S1Permission[]) =>
    applyDecorators(SetMetadata(REQUIRED_PERMISSIONS, permissions), UseGuards(SessionGuard, OrgContextGuard));

export const CurrentOrg = createParamDecorator((_data: unknown, ctx: ExecutionContext): OrgContext => {
    const req = ctx.switchToHttp().getRequest<Request & { org?: OrgContext }>();
    if (!req.org) {
        throw forbidden('No organization context');
    }
    return req.org;
});

export const CurrentAudit = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): AuditContext => {
        const req = ctx.switchToHttp().getRequest<
            Request & { auth?: SessionContext; org?: OrgContext }
        >();
        if (!req.auth || !req.org) {
            throw forbidden('No organization context');
        }
        return auditContextFromOrg(req.org, req.auth.identityId, requestIdFrom(req));
    },
);
