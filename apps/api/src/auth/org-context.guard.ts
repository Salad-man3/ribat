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
import { isStaff, permissionsFor } from './permissions';
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
            },
        });

        if (memberships.length !== 1) {
            throw forbidden('No active organization context');
        }

        const membership = memberships[0];
        const viewForPerms = session.activeView;
        const permissions = permissionsFor(membership.role, viewForPerms);

        req.org = {
            organizationId: membership.organizationId,
            membershipId: membership.id,
            memberId: membership.memberId,
            role: membership.role,
            activeView: isStaff(membership.role) ? session.activeView : null,
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
                    {
                        organizationId: membership.organizationId,
                        actorIdentityId: session.identityId,
                        actorMembershipId: membership.id,
                        requestId: requestIdFrom(req),
                    },
                    {
                        action: 'permission.denied',
                        entityType: 'route',
                        entityId: membership.id,
                        after: {
                            required,
                            method: req.method,
                            path: req.path,
                        },
                    },
                );
                throw forbidden();
            }
        }

        return true;
    }
}

export function OrgRoute(...permissions: S1Permission[]) {
    return applyDecorators(
        SetMetadata(REQUIRED_PERMISSIONS, permissions),
        UseGuards(SessionGuard, OrgContextGuard),
    );
}

export const CurrentOrg = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): OrgContext => {
        const request = ctx.switchToHttp().getRequest<Request & { org?: OrgContext }>();
        if (!request.org) {
            throw forbidden('Organization context required');
        }
        return request.org;
    },
);

/** The audit context for an @OrgRoute handler: the org, the signed-in identity and the request id. */
export const CurrentAudit = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuditContext => {
    const request = ctx
        .switchToHttp()
        .getRequest<Request & { org?: OrgContext; auth?: SessionContext }>();
    if (!request.org || !request.auth) throw forbidden('No active organization context');
    return auditContextFromOrg(request.org, request.auth.identityId, requestIdFrom(request));
});
