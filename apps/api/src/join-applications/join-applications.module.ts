import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GuardiansModule } from '../guardians/guardians.module';
import { MembersModule } from '../members/members.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { JoinApplicationsController } from './join-applications.controller';
import { JoinApplicationsService } from './join-applications.service';
import { PublicJoinApplicationsController } from './public-join-applications.controller';

@Module({
  imports: [AuthModule, MembersModule, MembershipsModule, GuardiansModule],
  controllers: [JoinApplicationsController, PublicJoinApplicationsController],
  providers: [JoinApplicationsService],
})
export class JoinApplicationsModule {}
