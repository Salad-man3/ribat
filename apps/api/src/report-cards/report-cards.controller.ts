import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  CreateReportCardSchema,
  ListReportCardsQuerySchema,
  UpdateReportCardCommentSchema,
  type CreateReportCardInput,
  type ListReportCardsQuery,
  type UpdateReportCardCommentInput,
} from '@ribat/shared';
import { CurrentAudit, CurrentOrg, OrgRoute, type OrgContext } from '../auth/org-context.guard';
import type { AuditContext } from '../audit/audit-context';
import { createZodValidationPipe } from '../common/zod-validation.pipe';
import { ReportCardsService } from './report-cards.service';

@Controller('report-cards')
export class ReportCardsController {
  constructor(private readonly cards: ReportCardsService) {}

  @Get()
  @OrgRoute()
  list(
    @CurrentOrg() org: OrgContext,
    @Query(createZodValidationPipe(ListReportCardsQuerySchema)) query: ListReportCardsQuery,
  ) {
    return this.cards.list(org, query);
  }

  @Post()
  @OrgRoute()
  create(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Body(createZodValidationPipe(CreateReportCardSchema)) body: CreateReportCardInput,
  ) {
    return this.cards.create(org, body, audit);
  }

  @Get(':id')
  @OrgRoute()
  get(@CurrentOrg() org: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.cards.get(org, id);
  }

  @Patch(':id')
  @OrgRoute()
  comment(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(createZodValidationPipe(UpdateReportCardCommentSchema)) body: UpdateReportCardCommentInput,
  ) {
    return this.cards.updateComment(org, id, body, audit);
  }

  @Post(':id/publish')
  @OrgRoute()
  publish(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cards.publish(org, id, audit);
  }
}
