import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GuardiansModule } from '../guardians/guardians.module';
import { HouseholdsModule } from '../households/households.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { CustomFieldsModule } from '../custom-fields/custom-fields.module';
import { TagsModule } from '../tags/tags.module';
import { MemberNotesModule } from '../notes/member-notes.module';
import { MembersController } from './members.controller';
import { MembersRepository } from './members.repository';
import { MembersService } from './members.service';

@Module({
  imports: [
    AuthModule,
    MembershipsModule,
    HouseholdsModule,
    GuardiansModule,
    MemberNotesModule,
    CustomFieldsModule,
    TagsModule,
  ],
  controllers: [MembersController],
  providers: [MembersService, MembersRepository],
  exports: [MembersService],
})
export class MembersModule {}