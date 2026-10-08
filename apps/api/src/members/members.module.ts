import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HouseholdsModule } from '../households/households.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { MembersController } from './members.controller';
import { MembersRepository } from './members.repository';
import { MembersService } from './members.service';

@Module({
  imports: [AuthModule, MembershipsModule, HouseholdsModule],
  controllers: [MembersController],
  providers: [MembersService, MembersRepository],
})
export class MembersModule {}