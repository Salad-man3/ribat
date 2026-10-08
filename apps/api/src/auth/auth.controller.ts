import { Body, Controller, Post } from '@nestjs/common';
import { RedeemSetupCodeSchema, type RedeemSetupCodeInput } from '@ribat/shared';
import { createZodValidationPipe } from '../common/zod-validation.pipe';
import { IdentitiesService } from './identities.service';

@Controller('auth')
export class AuthController {
    constructor(private readonly identities: IdentitiesService) { }

    @Post('setup')
    setup(@Body(createZodValidationPipe(RedeemSetupCodeSchema)) body: RedeemSetupCodeInput) {
        return this.identities.redeemSetupCode(body);
    }
}