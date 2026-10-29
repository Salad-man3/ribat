import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GuardiansService } from './guardians.service';
import { GuardianLinksController } from './guardian-links.controller';
import { WardsController } from './wards.controller';

@Module({
  imports: [AuthModule],
  controllers: [WardsController, GuardianLinksController],
  providers: [GuardiansService],
  exports: [GuardiansService],
})
export class GuardiansModule {}
