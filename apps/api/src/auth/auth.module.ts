import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { CsrfGuard } from './csrf.guard';
import { IdentitiesService } from './identities.service';
import { OrgContextGuard } from './org-context.guard';
import { SessionGuard } from './session.guard';
import { SessionsService } from './sessions.service';

@Module({
    controllers: [AuthController],
    providers: [
        IdentitiesService,
        SessionsService,
        SessionGuard,
        OrgContextGuard,
        CsrfGuard,
        { provide: APP_GUARD, useClass: CsrfGuard },
    ],
    exports: [IdentitiesService, SessionsService, SessionGuard, OrgContextGuard],
})
export class AuthModule { }