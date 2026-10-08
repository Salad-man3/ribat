import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GuardiansService } from './guardians.service';
import { WardsController } from './wards.controller';

@Module({
  imports: [AuthModule],
  controllers: [WardsController],
  providers: [GuardiansService],
  exports: [GuardiansService],
})
export class GuardiansModule {}
