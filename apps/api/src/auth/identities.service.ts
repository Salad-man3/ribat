import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { LoginResponse, RedeemSetupCodeInput } from '@ribat/shared';
import { PrismaService } from '../prisma/prisma.service';
import { generateSetupCode, hashSecret, verifySecret } from './credentials';

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

function disabledAccount(): ConflictException {
    return new ConflictException({
        error: { code: 'CONFLICT', message: 'Account is disabled' },
    });
}

@Injectable()
export class IdentitiesService {
    private dummyHash?: string;

    constructor(private readonly prisma: PrismaService) { }

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

        const passwordHash = await hashSecret(input.password);
        const now = new Date();

        await this.prisma.platform.$transaction(async (tx) => {
            const claimed = await tx.accountSetupCode.updateMany({
                where: { id: matchedId, usedAt: null, expiresAt: { gt: now } },
                data: { usedAt: now },
            });
            if (claimed.count !== 1) throw invalidSetup();

            await tx.accountSetupCode.updateMany({
                where: { identityId: identity.id, usedAt: null },
                data: { usedAt: now },
            });

            const passwordSet = await tx.identity.updateMany({
                where: { id: identity.id, status: 'ACTIVE' },
                data: { passwordHash },
            });
            if (passwordSet.count !== 1) throw invalidSetup();

            // T106: revoke AuthSession rows for this identity here.
        });

        return this.sessionResponse(identity.id);
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

    private async sessionResponse(identityId: string): Promise<LoginResponse> {
        const identity = await this.prisma.platform.identity.findUniqueOrThrow({
            where: { id: identityId },
            select: { id: true, phone: true, platformRole: true, status: true },
        });
        const memberships = await this.prisma.platform.membership.findMany({
            where: { identityId },
            include: { organization: { select: { name: true } } },
            orderBy: { createdAt: 'asc' },
        });
        const active = memberships.filter((membership) => membership.status === 'ACTIVE');

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
            activeOrganizationId: active.length === 1 ? active[0].organizationId : null,
            activeView: null,
            permissions: [],
        };
    }
}