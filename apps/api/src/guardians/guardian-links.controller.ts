import { Controller, Get, Query } from '@nestjs/common';
import {
  ListGuardianLinksQuerySchema,
  type ListGuardianLinksQuery,
} from '@ribat/shared';
import { CurrentOrg, OrgRoute, type OrgContext } from '../auth/org-context.guard';
import { createZodValidationPipe } from '../common/zod-validation.pipe';
import { GuardiansService } from './guardians.service';

@Controller('guardian-links')
export class GuardianLinksController {
  constructor(private readonly guardians: GuardiansService) {}

  @Get()
  @OrgRoute('members.manage')
  list(
    @CurrentOrg() org: OrgContext,
    @Query(createZodValidationPipe(ListGuardianLinksQuerySchema))
    query: ListGuardianLinksQuery,
  ) {
    return this.guardians.listForStaff(org.organizationId, query);
  }
}
