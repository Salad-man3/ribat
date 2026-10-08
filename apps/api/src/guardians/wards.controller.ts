import { Controller, ForbiddenException, Get } from '@nestjs/common';
import { CurrentOrg, OrgRoute, type OrgContext } from '../auth/org-context.guard';
import { GuardiansService } from './guardians.service';

@Controller('wards')
export class WardsController {
  constructor(private readonly guardians: GuardiansService) {}

  @Get()
  @OrgRoute()
  list(@CurrentOrg() org: OrgContext) {
    if (org.role !== 'GUARDIAN') {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'Forbidden' },
      });
    }
    return this.guardians.listWards(org.organizationId, org.memberId);
  }
}
