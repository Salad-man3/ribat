import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IdentitiesService } from './identities.service';

jest.mock('./credentials', () => ({
    generateSetupCode: jest.fn(() => 'AB23DEF4'),
    hashSecret: jest.fn(async (plain: string) => `hashed:${plain}`),
    verifySecret: jest.fn(async (hash: string, plain: string) => hash === `hashed:${plain}`),
}));

const phone = '+963944000111';
const identityId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const membershipId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const organizationId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

function platform() {
    const tx = {
        accountSetupCode: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            create: jest.fn(),
        },
        identity: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        authSession: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
    };
    return {
        tx,
        client: {
            identity: {
                findUnique: jest.fn(),
                findUniqueOrThrow: jest.fn(),
                create: jest.fn(),
                update: jest.fn().mockResolvedValue({}),
            },
            accountSetupCode: {
                findMany: jest.fn(),
            },
            membership: {
                findMany: jest.fn(),
            },
            $transaction: jest.fn(async (fn: (trx: typeof tx) => Promise<void>) => fn(tx)),
        },
    };
}

describe('IdentitiesService', () => {
    it('reuses an existing phone', async () => {
        const db = platform();
        db.client.identity.findUnique.mockResolvedValue({
            id: identityId,
            phone,
            status: 'ACTIVE',
            passwordHash: null,
        });
        const service = new IdentitiesService({ platform: db.client } as unknown as PrismaService);

        const result = await service.ensureIdentity(phone);

        expect(result).toEqual({ id: identityId, phone, hasPassword: false });
        expect(db.client.identity.create).not.toHaveBeenCalled();
    });

    it('rejects a disabled account when staff try to attach it', async () => {
        const db = platform();
        db.client.identity.findUnique.mockResolvedValue({
            id: identityId,
            phone,
            status: 'DISABLED',
            passwordHash: null,
        });
        const service = new IdentitiesService({ platform: db.client } as unknown as PrismaService);

        await expect(service.ensureIdentity(phone)).rejects.toBeInstanceOf(ConflictException);
    });

    it('stores a hash and returns the plaintext code once', async () => {
        const db = platform();
        const service = new IdentitiesService({ platform: db.client } as unknown as PrismaService);

        const issued = await service.issueSetupCode(identityId, membershipId);

        expect(issued.setupCode).toBe('AB23DEF4');
        expect(db.tx.accountSetupCode.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    identityId,
                    codeHash: 'hashed:AB23DEF4',
                    createdByMembershipId: membershipId,
                }),
            }),
        );
    });

    it('sets the password when the code matches', async () => {
        const db = platform();
        db.client.identity.findUnique.mockResolvedValue({
            id: identityId,
            phone,
            status: 'ACTIVE',
            passwordHash: null,
        });
        db.client.accountSetupCode.findMany.mockResolvedValue([
            { id: 'code-1', codeHash: 'hashed:AB23DEF4' },
        ]);
        db.client.identity.findUniqueOrThrow.mockResolvedValue({
            id: identityId,
            phone,
            platformRole: 'NONE',
            status: 'ACTIVE',
        });
        db.client.membership.findMany.mockResolvedValue([
            {
                id: membershipId,
                organizationId,
                organization: { name: 'Test Mosque' },
                role: 'MEMBER',
                memberId: null,
                status: 'ACTIVE',
            },
        ]);
        const service = new IdentitiesService({ platform: db.client } as unknown as PrismaService);

        const result = await service.redeemSetupCode({
            phone,
            code: 'ab23def4',
            password: 'longenough',
        });

        expect(result.identity.id).toBe(identityId);
        expect(result.activeOrganizationId).toBe(organizationId);
        expect(result.permissions).toEqual([]);
        expect(db.tx.identity.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ passwordHash: 'hashed:longenough' }),
            }),
        );
        expect(db.tx.authSession.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { identityId, revokedAt: null },
            }),
        );
    });

    it('returns the same 401 when the phone is unknown', async () => {
        const db = platform();
        db.client.identity.findUnique.mockResolvedValue(null);
        const service = new IdentitiesService({ platform: db.client } as unknown as PrismaService);

        await expect(
            service.redeemSetupCode({ phone, code: 'AB23DEF4', password: 'longenough' }),
        ).rejects.toBeInstanceOf(UnauthorizedException);
        expect(db.client.$transaction).not.toHaveBeenCalled();
    });

    it('returns the same 401 when the code does not match', async () => {
        const db = platform();
        db.client.identity.findUnique.mockResolvedValue({
            id: identityId,
            phone,
            status: 'ACTIVE',
            passwordHash: null,
        });
        db.client.accountSetupCode.findMany.mockResolvedValue([
            { id: 'code-1', codeHash: 'hashed:ZZZZZZZZ' },
        ]);
        const service = new IdentitiesService({ platform: db.client } as unknown as PrismaService);

        await expect(
            service.redeemSetupCode({ phone, code: 'AB23DEF4', password: 'longenough' }),
        ).rejects.toBeInstanceOf(UnauthorizedException);
        expect(db.client.$transaction).not.toHaveBeenCalled();
    });

    it('returns the identity id when the password matches', async () => {
        const db = platform();
        db.client.identity.findUnique.mockResolvedValue({
            id: identityId,
            status: 'ACTIVE',
            passwordHash: 'hashed:longenough',
        });
        const service = new IdentitiesService({ platform: db.client } as unknown as PrismaService);

        await expect(service.authenticate(phone, 'longenough')).resolves.toBe(identityId);
        expect(db.client.identity.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: identityId } }),
        );
    });

    it('returns the same 401 for an unknown phone and a disabled account', async () => {
        const db = platform();
        const service = new IdentitiesService({ platform: db.client } as unknown as PrismaService);

        db.client.identity.findUnique.mockResolvedValue(null);
        await expect(service.authenticate(phone, 'longenough')).rejects.toBeInstanceOf(UnauthorizedException);

        db.client.identity.findUnique.mockResolvedValue({
            id: identityId,
            status: 'DISABLED',
            passwordHash: 'hashed:longenough',
        });
        await expect(service.authenticate(phone, 'longenough')).rejects.toBeInstanceOf(UnauthorizedException);
        expect(db.client.identity.update).not.toHaveBeenCalled();
    });
});