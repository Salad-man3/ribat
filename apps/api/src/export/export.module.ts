import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrgExportController } from './org-export.controller';
import { OrgExportService } from './org-export.service';

@Module({
  imports: [AuthModule],
  controllers: [OrgExportController],
  providers: [OrgExportService],
  exports: [OrgExportService],
})
export class ExportModule {}
