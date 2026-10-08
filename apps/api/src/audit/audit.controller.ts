import { Controller, Get, Query } from '@nestjs/common';
import { ListAuditQuerySchema, type ListAuditQuery } from '@ribat/shared';
import { CurrentOrg, OrgRoute, type OrgContext } from '../auth/org-context.guard';
import { createZodValidationPipe } from '../common/zod-validation.pipe';
import { AuditService } from './audit.service';

@Controller('audit')
@OrgRoute('audit.read')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(
    @CurrentOrg() org: OrgContext,
    @Query(createZodValidationPipe(ListAuditQuerySchema)) query: ListAuditQuery,
  ) {
    return this.audit.list(org.organizationId, query);
  }
}
