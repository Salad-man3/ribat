import { Module } from '@nestjs/common';
import { MemberNotesService } from './member-notes.service';

@Module({
  providers: [MemberNotesService],
  exports: [MemberNotesService],
})
export class MemberNotesModule {}
