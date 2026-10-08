import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
    createParamDecorator,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { clearSessionCookie, readSessionCookie, writeSessionCookie } from './session-cookie';
import { SessionsService, type SessionContext } from './sessions.service';

function signInRequired(): UnauthorizedException {
    return new UnauthorizedException({
        error: { code: 'UNAUTHORIZED', message: 'Sign in required' },
    });
}

@Injectable()
export class SessionGuard implements CanActivate {
    constructor(private readonly sessions: SessionsService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const http = context.switchToHttp();
        const req = http.getRequest<Request & { auth?: SessionContext }>();
        const res = http.getResponse<Response>();
        const token = readSessionCookie(req.headers.cookie);
        const resolved = await this.sessions.resolve(token);
        if (!resolved || !token) {
            clearSessionCookie(res, this.sessions.secure);
            throw signInRequired();
        }
        req.auth = resolved.ctx;
        if (resolved.renew) writeSessionCookie(res, token, this.sessions.secure);
        return true;
    }
}

export const CurrentSession = createParamDecorator((_data: unknown, ctx: ExecutionContext): SessionContext => {
    const request = ctx.switchToHttp().getRequest<Request & { auth?: SessionContext }>();
    if (!request.auth) throw signInRequired();
    return request.auth;
});