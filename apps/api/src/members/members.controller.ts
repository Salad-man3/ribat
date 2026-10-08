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
  GrantMemberAccessSchema,
  ListMembersQuerySchema,
  ResetSetupCodeSchema,
  UpdateMemberSchema,
  type CreateMemberInput,
  type GrantMemberAccessInput,
  type ListMembersQuery,
  type ResetSetupCodeInput,
  type UpdateMemberInput,
} from '@ribat/shared';
import { auditContextFromOrg, requestIdFrom } from '../audit/audit-context';
import { CurrentOrg, OrgRoute, type OrgContext } from '../auth/org-context.guard';
import { CurrentSession, type SessionContext } from '../auth/session.guard';
import { createZodValidationPipe } from '../common/zod-validation.pipe';
import { MembershipsService } from '../memberships/memberships.service';
import { MembersService } from './members.service';

@Controller('members')
export class MembersController {
  constructor(
    private readonly membersService: MembersService,
    private readonly membershipsService: MembershipsService,
  ) {}

  private auditCtx(org: OrgContext, session: SessionContext, req: Request) {
    return auditContextFromOrg(org, session.identityId, requestIdFrom(req));
  }

  @Get()
  @OrgRoute('members.manage')
  list(
    @CurrentOrg() org: OrgContext,
    @Query(createZodValidationPipe(ListMembersQuerySchema)) query: ListMembersQuery,
  ) {
    return this.membersService.list(org.organizationId, query);
  }

  @Post()
  @OrgRoute('members.manage')
  create(
    @CurrentOrg() org: OrgContext,
    @CurrentSession() session: SessionContext,
    @Req() req: Request,
    @Body(createZodValidationPipe(CreateMemberSchema)) body: CreateMemberInput,
  ) {
    return this.membersService.create(org.organizationId, body, this.auditCtx(org, session, req));
  }

  @Get(':id')
  @OrgRoute('members.manage')
  getById(
    @CurrentOrg() org: OrgContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.membersService.getById(org.organizationId, id);
  }

  @Patch(':id')
  @OrgRoute('members.manage')
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
  @OrgRoute('members.manage')
  archive(
    @CurrentOrg() org: OrgContext,
    @CurrentSession() session: SessionContext,
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.membersService.archive(org.organizationId, id, this.auditCtx(org, session, req));
  }

  @Post(':id/access')
  @OrgRoute('memberships.manage')
  grantAccess(
    @CurrentOrg() org: OrgContext,
    @CurrentSession() session: SessionContext,
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(createZodValidationPipe(GrantMemberAccessSchema)) body: GrantMemberAccessInput,
  ) {
    return this.membershipsService.grantMemberAccess(
      org.organizationId,
      id,
      org,
      session.identityId,
      body.role,
      body.currentPassword,
      this.auditCtx(org, session, req),
    );
  }

  @Post(':id/access/reset-code')
  @OrgRoute('memberships.manage')
  resetAccessCode(
    @CurrentOrg() org: OrgContext,
    @CurrentSession() session: SessionContext,
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(createZodValidationPipe(ResetSetupCodeSchema)) body: ResetSetupCodeInput,
  ) {
    return this.membershipsService.resetMemberSetupCode(
      org.organizationId,
      id,
      org,
      session.identityId,
      body.currentPassword,
      this.auditCtx(org, session, req),
    );
  }
}
