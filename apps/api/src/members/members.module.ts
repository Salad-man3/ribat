import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GuardiansModule } from '../guardians/guardians.module';
import { HouseholdsModule } from '../households/households.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { MemberNotesModule } from '../notes/member-notes.module';
import { MembersController } from './members.controller';
import { MembersRepository } from './members.repository';
import { MembersService } from './members.service';

@Module({
  imports: [AuthModule, MembershipsModule, HouseholdsModule, GuardiansModule, MemberNotesModule],
  controllers: [MembersController],
  providers: [MembersService, MembersRepository],
})
export class MembersModule {}