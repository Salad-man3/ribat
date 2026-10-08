import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { CsrfGuard } from './csrf.guard';
import {
    CSRF_HEADER,
    SESSION_COOKIE,
    csrfTokenFor,
    hashSessionToken,
    newSessionToken,
} from './session-cookie';
import { SessionsService } from './sessions.service';

const env = { SESSION_SECRET: 'csrf-test-secret', NODE_ENV: 'test' } as Env;

function mockContext(method: string, cookie?: string, csrfHeader?: string): ExecutionContext {
    const req = {
        method,
        headers: { cookie },
        header: (name: string) => (name.toLowerCase() === CSRF_HEADER ? csrfHeader : undefined),
    };
    return {
        switchToHttp: () => ({ getRequest: () => req }),
    } as ExecutionContext;
}

describe('CsrfGuard', () => {
    let guard: CsrfGuard;
    let sessions: SessionsService;

    beforeEach(async () => {
        const prisma = { platform: { authSession: {} } } as unknown as PrismaService;
        sessions = new SessionsService(prisma, env);
        const module = await Test.createTestingModule({
            providers: [
                CsrfGuard,
                { provide: SessionsService, useValue: sessions },
            ],
        }).compile();
        guard = module.get(CsrfGuard);
    });

    it('csrfTokenFor is not the session token hash', () => {
        const token = newSessionToken();
        expect(csrfTokenFor(token, env.SESSION_SECRET)).not.toBe(
            hashSessionToken(token, env.SESSION_SECRET),
        );
    });

    it('allows GET', () => {
        expect(guard.canActivate(mockContext('GET', `${SESSION_COOKIE}=abc`))).toBe(true);
    });

    it('allows POST without a session cookie', () => {
        expect(guard.canActivate(mockContext('POST'))).toBe(true);
    });

    it('rejects POST with session cookie but no CSRF header', () => {
        const token = newSessionToken();
        expect(() =>
            guard.canActivate(mockContext('POST', `${SESSION_COOKIE}=${token}`)),
        ).toThrow(ForbiddenException);
        try {
            guard.canActivate(mockContext('POST', `${SESSION_COOKIE}=${token}`));
        } catch (error) {
            expect((error as ForbiddenException).getResponse()).toMatchObject({
                error: { code: 'CSRF_INVALID' },
            });
        }
    });

    it('rejects POST with a wrong CSRF header', () => {
        const token = newSessionToken();
        expect(() =>
            guard.canActivate(
                mockContext('POST', `${SESSION_COOKIE}=${token}`, 'wrong-token'),
            ),
        ).toThrow(ForbiddenException);
    });

    it('allows POST when the header matches the session-bound token', () => {
        const token = newSessionToken();
        const csrf = csrfTokenFor(token, env.SESSION_SECRET);
        expect(
            guard.canActivate(mockContext('POST', `${SESSION_COOKIE}=${token}`, csrf)),
        ).toBe(true);
    });
});
