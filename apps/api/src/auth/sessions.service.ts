import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ActiveView, DeviceResponse } from '@ribat/shared';
import { timingSafeEqual } from 'node:crypto';
import type { Response } from 'express';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import {
    SESSION_YEAR_MS,
    clipUserAgent,
    clearSessionCookie,
    csrfTokenFor,
    hashSessionToken,
    newSessionToken,
    writeSessionCookie,
} from './session-cookie';

const RENEW_AFTER_MS = 24 * 60 * 60 * 1000;

export type SessionContext = {
    sessionId: string;
    identityId: string;
    activeView: ActiveView;
};

export type IssuedDevice = {
    deviceLabel?: string;
    userAgent?: string;
};

@Injectable()
export class SessionsService {
    constructor(
        private readonly prisma: PrismaService,
        @Inject(ENV) private readonly env: Env,
    ) { }

    get secure(): boolean {
        return this.env.NODE_ENV === 'production';
    }

    writeCookies(res: Response, sessionToken: string): void {
        writeSessionCookie(res, sessionToken, this.secure, this.env.SESSION_SECRET);
    }

    clearCookies(res: Response): void {
        clearSessionCookie(res, this.secure);
    }

    csrfMatches(sessionToken: string, header: string | undefined): boolean {
        if (!header) return false;
        const expected = csrfTokenFor(sessionToken, this.env.SESSION_SECRET);
        if (header.length !== expected.length) return false;
        return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
    }

    async issue(identityId: string, device: IssuedDevice): Promise<string> {
        const token = newSessionToken();
        const now = new Date();
        await this.prisma.platform.authSession.create({
            data: {
                identityId,
                tokenHash: hashSessionToken(token, this.env.SESSION_SECRET),
                deviceLabel: device.deviceLabel ?? null,
                userAgent: clipUserAgent(device.userAgent),
                lastSeenAt: now,
                expiresAt: new Date(now.getTime() + SESSION_YEAR_MS),
            },
        });
        return token;
    }

    /**
     * ponytail: one renewal per day per session. Renew on every request
     * if a day of lost lifetime is too coarse.
     */
    async resolve(token: string | undefined): Promise<{ ctx: SessionContext; renew: boolean } | null> {
        if (!token) return null;
        const row = await this.prisma.platform.authSession.findUnique({
            where: { tokenHash: hashSessionToken(token, this.env.SESSION_SECRET) },
            select: {
                id: true,
                identityId: true,
                activeView: true,
                revokedAt: true,
                expiresAt: true,
                lastSeenAt: true,
                identity: { select: { status: true } },
            },
        });
        const now = new Date();
        if (!row || row.revokedAt || row.expiresAt <= now || row.identity.status !== 'ACTIVE') {
            return null;
        }
        const renew = now.getTime() - row.lastSeenAt.getTime() >= RENEW_AFTER_MS;
        if (renew) {
            await this.prisma.platform.authSession.update({
                where: { id: row.id },
                data: {
                    lastSeenAt: now,
                    expiresAt: new Date(now.getTime() + SESSION_YEAR_MS),
                },
            });
        }
        return {
            ctx: {
                sessionId: row.id,
                identityId: row.identityId,
                activeView: row.activeView,
            },
            renew,
        };
    }

    async setView(sessionId: string, activeView: ActiveView): Promise<void> {
        await this.prisma.platform.authSession.update({
            where: { id: sessionId },
            data: { activeView },
        });
    }

    async list(identityId: string, currentSessionId: string): Promise<DeviceResponse[]> {
        const rows = await this.prisma.platform.authSession.findMany({
            where: { identityId, revokedAt: null, expiresAt: { gt: new Date() } },
            orderBy: { lastSeenAt: 'desc' },
            select: {
                id: true,
                deviceLabel: true,
                userAgent: true,
                createdAt: true,
                lastSeenAt: true,
                expiresAt: true,
            },
        });
        return rows.map((row) => ({
            id: row.id,
            deviceLabel: row.deviceLabel,
            userAgent: row.userAgent,
            createdAt: row.createdAt.toISOString(),
            lastSeenAt: row.lastSeenAt.toISOString(),
            expiresAt: row.expiresAt.toISOString(),
            current: row.id === currentSessionId,
        }));
    }

    /** Returns true when this browser's cookie must be cleared. */
    async revoke(
        identityId: string,
        currentSessionId: string,
        target: { all: true } | { id: string },
    ): Promise<boolean> {
        const now = new Date();
        if ('all' in target) {
            await this.prisma.platform.authSession.updateMany({
                where: { identityId, revokedAt: null },
                data: { revokedAt: now },
            });
            return true;
        }
        const claimed = await this.prisma.platform.authSession.updateMany({
            where: {
                id: target.id,
                identityId,
                revokedAt: null,
                expiresAt: { gt: now },
            },
            data: { revokedAt: now },
        });
        if (claimed.count !== 1) {
            throw new NotFoundException({
                error: { code: 'NOT_FOUND', message: 'Device not found' },
            });
        }
        return target.id === currentSessionId;
    }
}