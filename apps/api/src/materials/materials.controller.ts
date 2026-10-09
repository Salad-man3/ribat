import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  CreateMaterialSchema,
  UpdateMaterialSchema,
  type CreateMaterialInput,
  type UpdateMaterialInput,
} from '@ribat/shared';
import type { AuditContext } from '../audit/audit-context';
import {
  CurrentAudit,
  CurrentOrg,
  OrgRoute,
  type OrgContext,
} from '../auth/org-context.guard';
import { forbidden } from '../common/errors';
import { createZodValidationPipe } from '../common/zod-validation.pipe';
import { MaterialsService } from './materials.service';

@Controller('materials')
export class MaterialsController {
  constructor(private readonly materials: MaterialsService) {}

  /** The catalogue is not sensitive; teachers pick from it too. */
  @Get()
  @OrgRoute()
  list(@CurrentOrg() org: OrgContext) {
    return this.materials.list(org.organizationId);
  }

  @Post()
  @OrgRoute('materials.manage')
  create(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Body(createZodValidationPipe(CreateMaterialSchema))
    body: CreateMaterialInput,
  ) {
    return this.materials.create(org.organizationId, body, audit);
  }

  @Patch(':id')
  @OrgRoute()
  async update(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(createZodValidationPipe(UpdateMaterialSchema))
    body: UpdateMaterialInput,
  ) {
    await this.materials.findActive(org.organizationId, id);
    if (
      !org.permissions.includes('materials.manage') &&
      !(await this.materials.teachesMaterial(
        org.organizationId,
        org.memberId,
        id,
      ))
    ) {
      throw forbidden();
    }
    return this.materials.update(org.organizationId, id, body, audit);
  }

  @Post(':id/archive')
  @OrgRoute('materials.manage')
  archive(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.materials.archive(org.organizationId, id, audit);
  }
}
