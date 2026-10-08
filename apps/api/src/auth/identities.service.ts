import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ActiveView, LoginResponse, RedeemSetupCodeInput } from '@ribat/shared';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { generateSetupCode, hashSecret, verifySecret } from './credentials';
import { isStaff, permissionsFor } from './permissions';

const SETUP_CODE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type EnsuredIdentity = {
    id: string;
    phone: string;
    hasPassword: boolean;
};

export type IssuedSetupCode = {
    identityId: string;
    setupCode: string;
    expiresAt: string;
};

function invalidSetup(): UnauthorizedException {
    return new UnauthorizedException({
        error: { code: 'UNAUTHORIZED', message: 'Invalid phone or setup code' },
    });
}

function invalidLogin(): UnauthorizedException {
    return new UnauthorizedException({
        error: { code: 'UNAUTHORIZED', message: 'Invalid phone or password' },
    });
}

function disabledAccount(): ConflictException {
    return new ConflictException({
        error: { code: 'CONFLICT', message: 'Account is disabled' },
    });
}

@Injectable()
export class IdentitiesService {
    private dummyHash?: string;

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    async ensureIdentity(phone: string): Promise<EnsuredIdentity> {
        const existing = await this.prisma.platform.identity.findUnique({ where: { phone } });
        if (existing) return this.toEnsured(existing);

        try {
            const created = await this.prisma.platform.identity.create({ data: { phone } });
            return this.toEnsured(created);
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                const raced = await this.prisma.platform.identity.findUnique({ where: { phone } });
                if (raced) return this.toEnsured(raced);
            }
            throw error;
        }
    }

    async issueSetupCode(identityId: string, createdByMembershipId: string): Promise<IssuedSetupCode> {
        const setupCode = generateSetupCode();
        const codeHash = await hashSecret(setupCode);
        const expiresAt = new Date(Date.now() + SETUP_CODE_TTL_MS);

        await this.prisma.platform.$transaction(async (tx) => {
            await tx.accountSetupCode.updateMany({
                where: { identityId, usedAt: null },
                data: { usedAt: new Date() },
            });
            await tx.accountSetupCode.create({
                data: { identityId, codeHash, expiresAt, createdByMembershipId },
            });
        });

        const issuer = await this.prisma.platform.membership.findUnique({
            where: { id: createdByMembershipId },
            select: { organizationId: true, identityId: true },
        });
        if (issuer) {
            await this.audit.record(
                {
                    organizationId: issuer.organizationId,
                    actorIdentityId: issuer.identityId,
                    actorMembershipId: createdByMembershipId,
                },
                {
                    action: 'auth.setup_code_issued',
                    entityType: 'identity',
                    entityId: identityId,
                },
            );
        }

        return { identityId, setupCode, expiresAt: expiresAt.toISOString() };
    }

    async redeemSetupCode(input: RedeemSetupCodeInput): Promise<LoginResponse> {
        const code = input.code.toUpperCase();
        const identity = await this.prisma.platform.identity.findUnique({
            where: { phone: input.phone },
        });

        if (!identity || identity.status !== 'ACTIVE') {
            await verifySecret(await this.pad(), code);
            throw invalidSetup();
        }

        const candidates = await this.prisma.platform.accountSetupCode.findMany({
            where: {
                identityId: identity.id,
                usedAt: null,
                expiresAt: { gt: new Date() },
            },
        });

        let matchedId: string | null = null;
        if (candidates.length === 0) {
            await verifySecret(await this.pad(), code);
        } else {
            for (const candidate of candidates) {
                if (await verifySecret(candidate.codeHash, code)) {
                    matchedId = candidate.id;
                    break;
                }
            }
        }

        if (!matchedId) throw invalidSetup();
        const claimedId = matchedId;

        const passwordHash = await hashSecret(input.password);
        const now = new Date();

        await this.prisma.platform.$transaction(async (tx) => {
            const claimed = await tx.accountSetupCode.updateMany({
                where: { id: claimedId, usedAt: null, expiresAt: { gt: now } },
                data: { usedAt: now },
            });
            if (claimed.count !== 1) throw invalidSetup();

            await tx.accountSetupCode.updateMany({
                where: { identityId: identity.id, usedAt: null },
                data: { usedAt: now },
            });

            const passwordSet = await tx.identity.updateMany({
                where: { id: identity.id, status: 'ACTIVE' },
                data: { passwordHash, lastLoginAt: now },
            });
            if (passwordSet.count !== 1) throw invalidSetup();

            await tx.authSession.updateMany({
                where: { identityId: identity.id, revokedAt: null },
                data: { revokedAt: now },
            });
        });

        return this.profile(identity.id, 'ADMIN');
    }

    async authenticate(phone: string, password: string): Promise<string> {
        const identity = await this.prisma.platform.identity.findUnique({
            where: { phone },
            select: { id: true },
        });
        const ok = await this.passwordMatches(identity?.id ?? '00000000-0000-0000-0000-000000000000', password);
        if (!identity || !ok) throw invalidLogin();

        await this.prisma.platform.identity.update({
            where: { id: identity.id },
            data: { lastLoginAt: new Date() },
        });
        return identity.id;
    }

    async passwordMatches(identityId: string, password: string): Promise<boolean> {
        const identity = await this.prisma.platform.identity.findUnique({
            where: { id: identityId },
            select: { passwordHash: true, status: true },
        });
        const hash = identity?.status === 'ACTIVE' ? identity.passwordHash : null;
        if (!hash) {
            await verifySecret(await this.pad(), password);
            return false;
        }
        return verifySecret(hash, password);
    }

    async profile(identityId: string, sessionActiveView: ActiveView = 'ADMIN'): Promise<LoginResponse> {
        const identity = await this.prisma.platform.identity.findUniqueOrThrow({
            where: { id: identityId },
            select: { id: true, phone: true, platformRole: true, status: true },
        });
        const memberships = await this.prisma.platform.membership.findMany({
            where: { identityId },
            include: { organization: { select: { name: true, status: true } } },
            orderBy: { createdAt: 'asc' },
        });
        const active = memberships.filter(
            (membership) =>
                membership.status === 'ACTIVE' && membership.organization.status === 'ACTIVE',
        );

        const sole = active.length === 1 ? active[0] : null;
        const staff = sole ? isStaff(sole.role) : false;

        return {
            identity,
            memberships: memberships.map((membership) => ({
                id: membership.id,
                organizationId: membership.organizationId,
                organizationName: membership.organization.name,
                role: membership.role,
                memberId: membership.memberId,
                status: membership.status,
            })),
            activeOrganizationId: sole?.organizationId ?? null,
            activeView: staff ? sessionActiveView : null,
            permissions: sole ? permissionsFor(sole.role, sessionActiveView) : [],
        };
    }

    private toEnsured(identity: {
        id: string;
        phone: string;
        status: 'ACTIVE' | 'DISABLED';
        passwordHash: string | null;
    }): EnsuredIdentity {
        if (identity.status === 'DISABLED') throw disabledAccount();
        return {
            id: identity.id,
            phone: identity.phone,
            hasPassword: identity.passwordHash !== null,
        };
    }

    private async pad(): Promise<string> {
        this.dummyHash ??= await hashSecret('timing-pad');
        return this.dummyHash;
    }
}