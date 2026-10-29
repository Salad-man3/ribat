import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  CreateProgramSchema,
  UpdateProgramSchema,
  type CreateProgramInput,
  type UpdateProgramInput,
} from '@ribat/shared';
import type { AuditContext } from '../audit/audit-context';
import {
  CurrentAudit,
  CurrentOrg,
  OrgRoute,
  type OrgContext,
} from '../auth/org-context.guard';
import { createZodValidationPipe } from '../common/zod-validation.pipe';
import { ProgramsService } from './programs.service';

const id = new ParseUUIDPipe();

@Controller('programs')
export class ProgramsController {
  constructor(private readonly programs: ProgramsService) {}

  @Get()
  @OrgRoute('courses.manage')
  list(@CurrentOrg() org: OrgContext) {
    return this.programs.list(org.organizationId);
  }

  @Post()
  @OrgRoute('courses.manage')
  create(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Body(createZodValidationPipe(CreateProgramSchema)) body: CreateProgramInput,
  ) {
    return this.programs.create(org.organizationId, body, audit);
  }

  @Patch(':id')
  @OrgRoute('courses.manage')
  update(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Param('id', id) programId: string,
    @Body(createZodValidationPipe(UpdateProgramSchema)) body: UpdateProgramInput,
  ) {
    return this.programs.update(org.organizationId, programId, body, audit);
  }

  @Post(':id/archive')
  @HttpCode(200)
  @OrgRoute('courses.manage')
  archive(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Param('id', id) programId: string,
  ) {
    return this.programs.archive(org.organizationId, programId, audit);
  }
}
