import { INestApplication } from '@nestjs/common';
import type { MembershipRole, PrismaClient } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types';
import { hashSecret } from '../../src/auth/credentials';
import { CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE } from '../../src/auth/session-cookie';

let phoneSeq = 0;

export type AuthenticatedSession = {
    identityId: string;
    cookie: string;
    csrf: string;
    csrfHeader: typeof CSRF_HEADER;
};

function parseSetCookies(setCookie: string[] | string | undefined): Record<string, string> {
    const lines = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
    const out: Record<string, string> = {};
    for (const line of lines) {
        const [pair] = line.split(';');
        const eq = pair.indexOf('=');
        if (eq === -1) continue;
        out[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
    }
    return out;
}

export function browserCookieHeader(setCookie: string[] | string | undefined): string {
    return Object.entries(parseSetCookies(setCookie))
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');
}

export async function loginAs(
    prisma: PrismaClient,
    app: INestApplication<App>,
    organizationId: string,
    role: MembershipRole,
    password = 'longenough',
): Promise<AuthenticatedSession> {
    phoneSeq += 1;
    const phone = `+963944${String(900000 + phoneSeq).padStart(6, '0')}`;
    const passwordHash = await hashSecret(password);
    const identity = await prisma.identity.create({ data: { phone, passwordHash } });
    await prisma.membership.create({
        data: {
            organizationId,
            identityId: identity.id,
            role,
            status: 'ACTIVE',
        },
    });

    const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ phone, password })
        .expect(201);

    const setCookie = login.headers['set-cookie'];
    const parsed = parseSetCookies(setCookie);
    if (!parsed[SESSION_COOKIE] || !parsed[CSRF_COOKIE]) {
        throw new Error('login did not set session cookies');
    }

    return {
        identityId: identity.id,
        cookie: browserCookieHeader(setCookie),
        csrf: parsed[CSRF_COOKIE],
        csrfHeader: CSRF_HEADER,
    };
}

export async function removeAuthFixtures(
    prisma: PrismaClient,
    identityIds: string[],
): Promise<void> {
    if (identityIds.length === 0) return;
    await prisma.auditLog.deleteMany({
        where: {
            OR: [
                { actorIdentityId: { in: identityIds } },
                { actorMembership: { identityId: { in: identityIds } } },
            ],
        },
    });
    await prisma.accountSetupCode.deleteMany({ where: { identityId: { in: identityIds } } });
    await prisma.authSession.deleteMany({ where: { identityId: { in: identityIds } } });
    await prisma.membership.deleteMany({ where: { identityId: { in: identityIds } } });
    await prisma.identity.deleteMany({ where: { id: { in: identityIds } } });
}
