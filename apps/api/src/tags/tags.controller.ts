import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  CreateTagSchema,
  UpdateTagSchema,
  type CreateTagInput,
  type UpdateTagInput,
} from '@ribat/shared';
import type { AuditContext } from '../audit/audit-context';
import {
  CurrentAudit,
  CurrentOrg,
  OrgRoute,
  type OrgContext,
} from '../auth/org-context.guard';
import { createZodValidationPipe } from '../common/zod-validation.pipe';
import { TagsService } from './tags.service';

const id = new ParseUUIDPipe();

@Controller('tags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  @OrgRoute('members.manage')
  list(@CurrentOrg() org: OrgContext) {
    return this.tags.list(org.organizationId);
  }

  @Post()
  @OrgRoute('members.manage')
  create(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Body(createZodValidationPipe(CreateTagSchema)) body: CreateTagInput,
  ) {
    if (body.permissions !== undefined && org.role !== 'SHEIKH') {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'Only the sheikh may set tag privileges' },
      });
    }
    return this.tags.create(org.organizationId, body, audit);
  }

  @Patch(':id')
  @OrgRoute('members.manage')
  update(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Param('id', id) tagId: string,
    @Body(createZodValidationPipe(UpdateTagSchema)) body: UpdateTagInput,
  ) {
    if (body.permissions !== undefined && org.role !== 'SHEIKH') {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'Only the sheikh may set tag privileges' },
      });
    }
    return this.tags.update(org.organizationId, tagId, body, audit);
  }

  @Post(':id/archive')
  @HttpCode(200)
  @OrgRoute('members.manage')
  archive(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Param('id', id) tagId: string,
  ) {
    return this.tags.archive(org.organizationId, tagId, audit);
  }
}
