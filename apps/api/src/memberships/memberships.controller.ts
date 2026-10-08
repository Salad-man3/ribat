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
  CreateMembershipSchema,
  ListMembershipsQuerySchema,
  UpdateMembershipSchema,
  type CreateMembershipInput,
  type ListMembershipsQuery,
  type UpdateMembershipInput,
} from '@ribat/shared';
import { auditContextFromOrg, requestIdFrom } from '../audit/audit-context';
import { CurrentOrg, OrgRoute, type OrgContext } from '../auth/org-context.guard';
import { CurrentSession, type SessionContext } from '../auth/session.guard';
import { createZodValidationPipe } from '../common/zod-validation.pipe';
import { MembershipsService } from './memberships.service';

@Controller('memberships')
@OrgRoute('memberships.manage')
export class MembershipsController {
  constructor(private readonly memberships: MembershipsService) {}

  @Get()
  list(
    @CurrentOrg() org: OrgContext,
    @Query(createZodValidationPipe(ListMembershipsQuerySchema)) query: ListMembershipsQuery,
  ) {
    return this.memberships.list(org.organizationId, query);
  }

  @Post()
  create(
    @CurrentOrg() org: OrgContext,
    @CurrentSession() session: SessionContext,
    @Req() req: Request,
    @Body(createZodValidationPipe(CreateMembershipSchema)) body: CreateMembershipInput,
  ) {
    return this.memberships.create(
      org.organizationId,
      org,
      session.identityId,
      body,
      auditContextFromOrg(org, session.identityId, requestIdFrom(req)),
    );
  }

  @Patch(':id')
  update(
    @CurrentOrg() org: OrgContext,
    @CurrentSession() session: SessionContext,
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(createZodValidationPipe(UpdateMembershipSchema)) body: UpdateMembershipInput,
  ) {
    return this.memberships.update(
      org.organizationId,
      id,
      org,
      session.identityId,
      body,
      auditContextFromOrg(org, session.identityId, requestIdFrom(req)),
    );
  }
}
