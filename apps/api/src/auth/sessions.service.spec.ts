import { NotFoundException } from '@nestjs/common';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { hashSessionToken } from './session-cookie';
import { SessionsService } from './sessions.service';

const env = { SESSION_SECRET: 'test-secret', NODE_ENV: 'test' } as Env;
const identityId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const sessionId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

function service() {
    const authSession = {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const prisma = { platform: { authSession } } as unknown as PrismaService;
    return { authSession, sessions: new SessionsService(prisma, env) };
}

describe('SessionsService', () => {
    it('rejects a revoked, expired, or disabled session', async () => {
        const { authSession, sessions } = service();
        const token = 'raw-token';
        authSession.findUnique.mockResolvedValue({
            id: sessionId,
            identityId,
            revokedAt: new Date(),
            expiresAt: new Date(Date.now() + 60_000),
            lastSeenAt: new Date(),
            identity: { status: 'ACTIVE' },
        });

        await expect(sessions.resolve(token)).resolves.toBeNull();
        expect(authSession.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { tokenHash: hashSessionToken(token, env.SESSION_SECRET) },
            }),
        );
        expect(authSession.update).not.toHaveBeenCalled();
    });

    it('renews a session last seen more than a day ago', async () => {
        const { authSession, sessions } = service();
        authSession.findUnique.mockResolvedValue({
            id: sessionId,
            identityId,
            revokedAt: null,
            expiresAt: new Date(Date.now() + 60_000),
            lastSeenAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            identity: { status: 'ACTIVE' },
        });

        const resolved = await sessions.resolve('raw-token');

        expect(resolved?.ctx).toEqual({ sessionId, identityId });
        expect(resolved?.renew).toBe(true);
        expect(authSession.update).toHaveBeenCalled();
    });

    it('returns 404 when the device is not an active session of this identity', async () => {
        const { authSession, sessions } = service();
        authSession.updateMany.mockResolvedValue({ count: 0 });

        await expect(
            sessions.revoke(identityId, sessionId, { id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' }),
        ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('marks the calling session as current', async () => {
        const { authSession, sessions } = service();
        const seen = new Date();
        authSession.findMany.mockResolvedValue([
            {
                id: sessionId,
                deviceLabel: 'Phone',
                userAgent: 'test',
                createdAt: seen,
                lastSeenAt: seen,
                expiresAt: seen,
            },
        ]);

        const devices = await sessions.list(identityId, sessionId);

        expect(devices[0].current).toBe(true);
        expect(devices[0].createdAt).toBe(seen.toISOString());
    });
});