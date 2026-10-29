import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { StatsDashboardQuerySchema, type StatsDashboardQuery } from '@ribat/shared';
import { CurrentOrg, OrgRoute, type OrgContext } from '../auth/org-context.guard';
import { createZodValidationPipe } from '../common/zod-validation.pipe';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('dashboard')
  @OrgRoute('courses.manage')
  dashboard(
    @CurrentOrg() org: OrgContext,
    @Query(createZodValidationPipe(StatsDashboardQuerySchema)) query: StatsDashboardQuery,
  ) {
    return this.stats.dashboard(org, query);
  }

  @Get('courses/:id')
  @OrgRoute()
  course(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.stats.courseStats(org, id);
  }

  @Get('teachers/:id')
  @OrgRoute()
  teacher(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.stats.teacherStats(org, id);
  }

  @Get('members/:id')
  @OrgRoute()
  member(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.stats.memberStats(org, id);
  }
}
