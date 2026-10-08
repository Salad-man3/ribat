import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    ForbiddenException,
    Get,
    HttpCode,
    Param,
    Post,
    Query,
    Req,
    Res,
    UseGuards,
} from '@nestjs/common';
import {
    LoginSchema,
    RedeemSetupCodeSchema,
    RevokeDeviceQuerySchema,
    SwitchViewSchema,
    type LoginInput,
    type RedeemSetupCodeInput,
    type RevokeDeviceQuery,
    type SwitchViewInput,
} from '@ribat/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { createZodValidationPipe } from '../common/zod-validation.pipe';
import { auditContextFromOrg, requestIdFrom } from '../audit/audit-context';
import { AuditService } from '../audit/audit.service';
import { IdentitiesService } from './identities.service';
import { isStaff } from './permissions';
import { CurrentOrg, OrgRoute, type OrgContext } from './org-context.guard';
import { CurrentSession, SessionGuard } from './session.guard';
import { SessionsService, type SessionContext } from './sessions.service';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly identities: IdentitiesService,
        private readonly sessions: SessionsService,
        private readonly audit: AuditService,
    ) {}

    @Post('setup')
    async setup(
        @Body(createZodValidationPipe(RedeemSetupCodeSchema)) body: RedeemSetupCodeInput,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        const profile = await this.identities.redeemSetupCode(body);
        await this.audit.recordForIdentity(
            profile.identity.id,
            {
                action: 'auth.setup_redeemed',
                entityType: 'identity',
                entityId: profile.identity.id,
            },
            requestIdFrom(req),
        );
        const token = await this.sessions.issue(profile.identity.id, {
            deviceLabel: body.deviceLabel,
            userAgent: req.header('user-agent') ?? undefined,
        });
        this.sessions.writeCookies(res, token);
        return profile;
    }

    @Post('login')
    async login(
        @Body(createZodValidationPipe(LoginSchema)) body: LoginInput,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        const identityId = await this.identities.authenticate(body.phone, body.password);
        await this.audit.recordForIdentity(
            identityId,
            { action: 'auth.login', entityType: 'identity', entityId: identityId },
            requestIdFrom(req),
        );
        const token = await this.sessions.issue(identityId, {
            deviceLabel: body.deviceLabel,
            userAgent: req.header('user-agent') ?? undefined,
        });
        this.sessions.writeCookies(res, token);
        return this.identities.profile(identityId, 'ADMIN');
    }

    @Get('me')
    @UseGuards(SessionGuard)
    me(@CurrentSession() session: SessionContext) {
        return this.identities.profile(session.identityId, session.activeView);
    }

    @Post('switch-view')
    @HttpCode(200)
    @OrgRoute()
    async switchView(
        @Body(createZodValidationPipe(SwitchViewSchema)) body: SwitchViewInput,
        @CurrentSession() session: SessionContext,
        @CurrentOrg() org: OrgContext,
        @Req() req: Request,
    ) {
        if (!isStaff(org.role)) {
            throw new ForbiddenException({
                error: { code: 'FORBIDDEN', message: 'Forbidden' },
            });
        }
        await this.sessions.setView(session.sessionId, body.activeView);
        await this.audit.record(
            auditContextFromOrg(org, session.identityId, requestIdFrom(req)),
            {
                action: 'auth.view_switched',
                entityType: 'membership',
                entityId: org.membershipId,
                after: { activeView: body.activeView },
            },
        );
        return this.identities.profile(session.identityId, body.activeView);
    }

    @Post('logout')
    @HttpCode(204)
    @UseGuards(SessionGuard)
    async logout(
        @CurrentSession() session: SessionContext,
        @Res({ passthrough: true }) res: Response,
    ) {
        await this.sessions.revoke(session.identityId, session.sessionId, { id: session.sessionId });
        this.sessions.clearCookies(res);
    }

    @Get('devices')
    @UseGuards(SessionGuard)
    devices(@CurrentSession() session: SessionContext) {
        return this.sessions.list(session.identityId, session.sessionId);
    }

    @Delete('devices/:id')
    @HttpCode(204)
    @UseGuards(SessionGuard)
    async revokeDevice(
        @Param('id') id: string,
        @Query(createZodValidationPipe(RevokeDeviceQuerySchema)) query: RevokeDeviceQuery,
        @CurrentSession() session: SessionContext,
        @Res({ passthrough: true }) res: Response,
    ) {
        if (query.all !== 'true' && !z.string().uuid().safeParse(id).success) {
            throw new BadRequestException({
                error: { code: 'VALIDATION_ERROR', message: 'Invalid device id' },
            });
        }
        const clearCurrent = await this.sessions.revoke(
            session.identityId,
            session.sessionId,
            query.all === 'true' ? { all: true } : { id },
        );
        if (clearCurrent) this.sessions.clearCookies(res);
    }
}