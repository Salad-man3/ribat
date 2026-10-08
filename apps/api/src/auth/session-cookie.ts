import { createHmac, randomBytes } from 'node:crypto';
import type { Response } from 'express';

export const SESSION_COOKIE = 'ribat_session';
export const SESSION_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const USER_AGENT_MAX = 256;

export function newSessionToken(): string {
    return randomBytes(32).toString('base64url');
}

/** Deterministic, so SessionsService can findUnique the row. */
export function hashSessionToken(token: string, secret: string): string {
    return createHmac('sha256', secret).update(token).digest('base64url');
}

export function clipUserAgent(value: string | undefined): string | null {
    const trimmed = value?.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, USER_AGENT_MAX);
}

export function readSessionCookie(header: string | undefined): string | undefined {
    if (!header) return undefined;
    for (const part of header.split(';')) {
        const eq = part.indexOf('=');
        if (eq === -1) continue;
        if (part.slice(0, eq).trim() !== SESSION_COOKIE) continue;
        try {
            return decodeURIComponent(part.slice(eq + 1).trim());
        } catch {
            return undefined;
        }
    }
    return undefined;
}

function cookieBase(secure: boolean) {
    return {
        httpOnly: true,
        secure,
        sameSite: 'lax' as const,
        path: '/',
    };
}

export function writeSessionCookie(res: Response, token: string, secure: boolean) {
    res.cookie(SESSION_COOKIE, token, { ...cookieBase(secure), maxAge: SESSION_YEAR_MS });
}

export function clearSessionCookie(res: Response, secure: boolean) {
    res.clearCookie(SESSION_COOKIE, cookieBase(secure));
}