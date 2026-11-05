import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  CreateDoroosSchema,
  ListSessionsQuerySchema,
  PreviewSessionConflictsSchema,
  type CreateDoroosInput,
  type ListSessionsQuery,
  type PreviewSessionConflictsInput,
} from '@ribat/shared';
import {
  CurrentAudit,
  CurrentOrg,
  OrgRoute,
  type OrgContext,
} from '../auth/org-context.guard';
import type { AuditContext } from '../audit/audit-context';
import { createZodValidationPipe } from '../common/zod-validation.pipe';
import { DoroosService } from './doroos.service';
import { SessionConflictsService } from './session-conflicts.service';

@Controller()
export class DoroosController {
  constructor(
    private readonly doroos: DoroosService,
    private readonly conflicts: SessionConflictsService,
  ) {}

  @Get('doroos')
  @OrgRoute('courses.manage')
  list(
    @CurrentOrg() org: OrgContext,
    @Query(createZodValidationPipe(ListSessionsQuerySchema))
    query: ListSessionsQuery,
  ) {
    return this.doroos.list(org, query);
  }

  @Post('doroos')
  @OrgRoute('courses.manage')
  create(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Body(createZodValidationPipe(CreateDoroosSchema)) body: CreateDoroosInput,
  ) {
    return this.doroos.create(org, body, audit);
  }

  @Post('sessions/conflicts')
  @OrgRoute('courses.manage')
  previewConflicts(
    @CurrentOrg() org: OrgContext,
    @Body(createZodValidationPipe(PreviewSessionConflictsSchema))
    body: PreviewSessionConflictsInput,
  ) {
    return this.conflicts.findMemberConflicts(org, body);
  }
}
