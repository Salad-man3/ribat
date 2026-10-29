import { Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  ListJoinApplicationsQuerySchema,
  type ApproveJoinApplicationResponse,
  type JoinApplicationResponse,
  type ListJoinApplicationsQuery,
  type MemberAccessGap,
  type PublicOrganizationJoinInfo,
} from '@ribat/shared';
import { CurrentAudit, CurrentOrg, OrgRoute, type OrgContext } from '../auth/org-context.guard';
import type { AuditContext } from '../audit/audit-context';
import { createZodValidationPipe } from '../common/zod-validation.pipe';
import { JoinApplicationsService } from './join-applications.service';

@Controller('join-applications')
export class JoinApplicationsController {
  constructor(private readonly joinApplications: JoinApplicationsService) {}

  @Get()
  @OrgRoute('members.manage')
  list(
    @CurrentOrg() org: OrgContext,
    @Query(createZodValidationPipe(ListJoinApplicationsQuerySchema)) query: ListJoinApplicationsQuery,
  ): Promise<JoinApplicationResponse[]> {
    return this.joinApplications.list(org.organizationId, query);
  }

  @Get('join-info')
  @OrgRoute('members.manage')
  joinInfo(@CurrentOrg() org: OrgContext): Promise<PublicOrganizationJoinInfo> {
    return this.joinApplications.joinInfo(org.organizationId);
  }

  @Get('access-gaps')
  @OrgRoute('members.manage')
  accessGaps(@CurrentOrg() org: OrgContext): Promise<MemberAccessGap[]> {
    return this.joinApplications.listAccessGaps(org.organizationId);
  }

  @Post(':id/reject')
  @OrgRoute('members.manage')
  reject(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<JoinApplicationResponse> {
    return this.joinApplications.reject(org.organizationId, id, org, audit);
  }

  @Post(':id/approve')
  @OrgRoute('memberships.manage')
  approve(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApproveJoinApplicationResponse> {
    return this.joinApplications.approve(org.organizationId, id, org, audit);
  }
}
