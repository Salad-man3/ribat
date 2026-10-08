import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { IdentitiesService } from './identities.service';

@Module({
    controllers: [AuthController],
    providers: [IdentitiesService],
    exports: [IdentitiesService],
})
export class AuthModule { }