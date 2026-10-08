import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { IdentitiesService } from './identities.service';
import { SessionGuard } from './session.guard';
import { SessionsService } from './sessions.service';

@Module({
    controllers: [AuthController],
    providers: [IdentitiesService,
        SessionsService,
        SessionGuard],
    exports: [IdentitiesService,
        SessionsService,
        SessionGuard],
})
export class AuthModule { }