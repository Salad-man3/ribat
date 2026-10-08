import { createHmac, randomBytes } from 'node:crypto';
import type { Response } from 'express';

export const SESSION_COOKIE = 'ribat_session';
export const CSRF_COOKIE = 'ribat_csrf';
export const CSRF_HEADER = 'x-csrf-token';
export const SESSION_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const USER_AGENT_MAX = 256;

export function newSessionToken(): string {
    return randomBytes(32).toString('base64url');
}

/** Deterministic, so SessionsService can findUnique the row. */
export function hashSessionToken(token: string, secret: string): string {
    return createHmac('sha256', secret).update(token).digest('base64url');
}

/** Session-bound CSRF token; prefix keeps it distinct from tokenHash. */
export function csrfTokenFor(sessionToken: string, secret: string): string {
    return createHmac('sha256', secret).update(`csrf:${sessionToken}`).digest('base64url');
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

export function writeSessionCookie(
    res: Response,
    token: string,
    secure: boolean,
    secret: string,
) {
    const maxAge = SESSION_YEAR_MS;
    res.cookie(SESSION_COOKIE, token, { ...cookieBase(secure), maxAge });
    res.cookie(CSRF_COOKIE, csrfTokenFor(token, secret), {
        ...cookieBase(secure),
        httpOnly: false,
        maxAge,
    });
}

export function clearSessionCookie(res: Response, secure: boolean) {
    const base = cookieBase(secure);
    res.clearCookie(SESSION_COOKIE, base);
    res.clearCookie(CSRF_COOKIE, { ...base, httpOnly: false });
}