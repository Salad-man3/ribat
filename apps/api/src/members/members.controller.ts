import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  CreateMemberSchema,
  ListMembersQuerySchema,
  UpdateMemberSchema,
  type CreateMemberInput,
  type ListMembersQuery,
  type UpdateMemberInput,
} from '@ribat/shared';
import { auditContextFromOrg, requestIdFrom } from '../audit/audit-context';
import { CurrentOrg, OrgRoute, type OrgContext } from '../auth/org-context.guard';
import { CurrentSession, type SessionContext } from '../auth/session.guard';
import { createZodValidationPipe } from '../common/zod-validation.pipe';
import { MembersService } from './members.service';

@Controller('members')
@OrgRoute('members.manage')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  private auditCtx(org: OrgContext, session: SessionContext, req: Request) {
    return auditContextFromOrg(org, session.identityId, requestIdFrom(req));
  }

  @Get()
  list(
    @CurrentOrg() org: OrgContext,
    @Query(createZodValidationPipe(ListMembersQuerySchema)) query: ListMembersQuery,
  ) {
    return this.membersService.list(org.organizationId, query);
  }

  @Post()
  create(
    @CurrentOrg() org: OrgContext,
    @CurrentSession() session: SessionContext,
    @Req() req: Request,
    @Body(createZodValidationPipe(CreateMemberSchema)) body: CreateMemberInput,
  ) {
    return this.membersService.create(org.organizationId, body, this.auditCtx(org, session, req));
  }

  @Get(':id')
  getById(
    @CurrentOrg() org: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.membersService.getById(org.organizationId, id);
  }

  @Patch(':id')
  update(
    @CurrentOrg() org: OrgContext,
    @CurrentSession() session: SessionContext,
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(createZodValidationPipe(UpdateMemberSchema)) body: UpdateMemberInput,
  ) {
    return this.membersService.update(
      org.organizationId,
      id,
      body,
      this.auditCtx(org, session, req),
    );
  }

  @Post(':id/archive')
  archive(
    @CurrentOrg() org: OrgContext,
    @CurrentSession() session: SessionContext,
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.membersService.archive(org.organizationId, id, this.auditCtx(org, session, req));
  }
}
