import { Body, Controller, Post } from '@nestjs/common';
import {
  CreateAnnouncementSchema,
  type CreateAnnouncementInput,
} from '@ribat/shared';
import type { AuditContext } from '../audit/audit-context';
import {
  CurrentAudit,
  CurrentOrg,
  OrgRoute,
  type OrgContext,
} from '../auth/org-context.guard';
import { createZodValidationPipe } from '../common/zod-validation.pipe';
import { AnnouncementsService } from './announcements.service';

@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Post()
  @OrgRoute()
  send(
    @CurrentOrg() org: OrgContext,
    @CurrentAudit() audit: AuditContext,
    @Body(createZodValidationPipe(CreateAnnouncementSchema)) body: CreateAnnouncementInput,
  ) {
    return this.announcements.create(org, audit, body);
  }
}
