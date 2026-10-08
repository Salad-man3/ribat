import {
  Body,
  Controller,
  Delete,
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
  CreateGuardianLinkSchema,
  CreateMemberNoteSchema,
  CreateMemberSchema,
  GrantMemberAccessSchema,
  LinkSiblingSchema,
  ListMembersQuerySchema,
  ResetSetupCodeSchema,
  UpdateMemberSchema,
  type CreateGuardianLinkInput,
  type CreateMemberInput,
  type CreateMemberNoteInput,
  type GrantMemberAccessInput,
  type LinkSiblingInput,
  type ListMembersQuery,
  type ResetSetupCodeInput,
  type UpdateMemberInput,
} from '@ribat/shared';
import { GuardiansService } from '../guardians/guardians.service';
import { HouseholdsService } from '../households/households.service';
import { MemberNotesService } from '../notes/member-notes.service';
import { auditContextFromOrg, requestIdFrom } from '../audit/audit-context';
import { CurrentOrg, OrgRoute, type OrgContext } from '../auth/org-context.guard';
import { CurrentSession } from '../auth/session.guard';
import type { SessionContext } from '../auth/sessions.service';
import { createZodValidationPipe } from '../common/zod-validation.pipe';
import { MembershipsService } from '../memberships/memberships.service';
import { MembersService } from './members.service';

@Controller('members')
export class MembersController {
  constructor(
    private readonly membersService: MembersService,
    private readonly membershipsService: MembershipsService,
    private readonly householdsService: HouseholdsService,
    private readonly guardiansService: GuardiansService,
    private readonly memberNotesService: MemberNotesService,
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
    return this.membersService.list(org.organizationId, query, org);
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
    return this.membersService.getById(org.organizationId, id, org);
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

  @Get(':id/guardians')
  @OrgRoute('members.manage')
  listGuardians(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.guardiansService.list(org.organizationId, id);
  }

  @Post(':id/guardians')
  @OrgRoute('members.manage')
  createGuardian(
    @CurrentOrg() org: OrgContext,
    @CurrentSession() session: SessionContext,
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(createZodValidationPipe(CreateGuardianLinkSchema)) body: CreateGuardianLinkInput,
  ) {
    return this.guardiansService.create(
      org.organizationId,
      id,
      body,
      this.auditCtx(org, session, req),
    );
  }

  @Delete(':id/guardians/:linkId')
  @OrgRoute('members.manage')
  async removeGuardian(
    @CurrentOrg() org: OrgContext,
    @CurrentSession() session: SessionContext,
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
  ) {
    await this.guardiansService.remove(org.organizationId, id, linkId, this.auditCtx(org, session, req));
  }

  @Get(':id/notes')
  @OrgRoute()
  listNotes(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.memberNotesService.list(org.organizationId, id, org);
  }

  @Post(':id/notes')
  @OrgRoute('notes.write')
  createNote(
    @CurrentOrg() org: OrgContext,
    @CurrentSession() session: SessionContext,
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(createZodValidationPipe(CreateMemberNoteSchema)) body: CreateMemberNoteInput,
  ) {
    return this.memberNotesService.create(
      org.organizationId,
      id,
      org,
      body,
      this.auditCtx(org, session, req),
    );
  }

  @Post(':id/household')
  @OrgRoute('members.manage')
  linkSibling(
    @CurrentOrg() org: OrgContext,
    @CurrentSession() session: SessionContext,
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(createZodValidationPipe(LinkSiblingSchema)) body: LinkSiblingInput,
  ) {
    return this.householdsService.linkSibling(
      org.organizationId,
      id,
      body,
      this.auditCtx(org, session, req),
    );
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
