import { Throttle } from '@nestjs/throttler';
import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import {
  SetupOrganizationSchema,
  UpdateOrganizationSchema,
  type SetupOrganizationInput,
  type UpdateOrganizationInput,
} from '@ribat/shared';
import { CurrentOrg, OrgRoute, type OrgContext } from '../auth/org-context.guard';
import { createZodValidationPipe } from '../common/zod-validation.pipe';
import { OrganizationsService } from './organizations.service';

@Controller()
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get('setup/status')
  setupStatus() {
    return this.organizations.setupStatus();
  }

  @Post('setup/organization')
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  setupOrganization(
    @Body(createZodValidationPipe(SetupOrganizationSchema)) body: SetupOrganizationInput,
  ) {
    return this.organizations.setupOrganization(body);
  }

  @Get('organization')
  @OrgRoute('organization.manage')
  getOrganization(@CurrentOrg() org: OrgContext) {
    return this.organizations.getOrganization(org.organizationId);
  }

  @Patch('organization')
  @OrgRoute('organization.manage')
  updateOrganization(
    @CurrentOrg() org: OrgContext,
    @Body(createZodValidationPipe(UpdateOrganizationSchema)) body: UpdateOrganizationInput,
  ) {
    return this.organizations.updateOrganization(org.organizationId, body);
  }
}
