import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StatsJobsModule } from '../stats/stats-jobs.module';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [AuthModule, StatsJobsModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
