import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { CSRF_HEADER, readSessionCookie } from './session-cookie';
import { SessionsService } from './sessions.service';

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function csrfInvalid(): ForbiddenException {
    return new ForbiddenException({
        error: { code: 'CSRF_INVALID', message: 'Invalid CSRF token' },
    });
}

@Injectable()
export class CsrfGuard implements CanActivate {
    constructor(private readonly sessions: SessionsService) {}

    canActivate(context: ExecutionContext): boolean {
        const req = context.switchToHttp().getRequest<Request>();
        if (!UNSAFE.has(req.method)) return true;

        const sessionToken = readSessionCookie(req.headers.cookie);
        if (!sessionToken) return true;

        const header = req.header(CSRF_HEADER);
        if (!this.sessions.csrfMatches(sessionToken, header)) {
            throw csrfInvalid();
        }
        return true;
    }
}
