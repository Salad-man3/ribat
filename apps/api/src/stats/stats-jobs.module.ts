import { Module } from '@nestjs/common';
import { StatsRollupService } from './stats-rollup.service';

/** Nightly rollup only — imported by FamiliesModule (outbox) without pulling HTTP controllers. */
@Module({
  providers: [StatsRollupService],
  exports: [StatsRollupService],
})
export class StatsJobsModule {}
