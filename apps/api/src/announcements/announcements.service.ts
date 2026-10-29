import { Injectable } from '@nestjs/common';
import type {
  AnnouncementResponse,
  CreateAnnouncementInput,
} from '@ribat/shared';
import type { AuditContext } from '../audit/audit-context';
import { AuditService } from '../audit/audit.service';
import type { OrgContext } from '../auth/org-context.guard';
import { conflict, forbidden } from '../common/errors';
import { emit } from '../events/emit';
import { ClassScopeService } from '../progress/class-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { TagsService } from '../tags/tags.service';
import {
  resolveAnnouncementMemberIds,
  targetIdsFromAnnouncement,
} from './announcement-audience';
import { identitiesOf, withGuardians } from '../notifications/notify';

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly scope: ClassScopeService,
    private readonly tags: TagsService,
  ) {}

  async create(
    org: OrgContext,
    audit: AuditContext,
    input: CreateAnnouncementInput,
  ): Promise<AnnouncementResponse> {
    if (!org.memberId) throw forbidden('Your account has no member profile');
    const db = this.prisma.forOrganization(org.organizationId);
    const targetIds =
      input.targetType === 'EVERYONE' ? [] : [...new Set(input.targetIds)];
    const memberIds = await resolveAnnouncementMemberIds(
      db,
      org,
      this.scope,
      this.tags,
      input.targetType,
      targetIds,
    );
    if (memberIds.length === 0) throw conflict('Nobody to send this to');

    const previewIdentities = await identitiesOf(
      db,
      await withGuardians(db, memberIds),
    );
    if (previewIdentities.length === 0) {
      throw conflict('Nobody with a login to notify');
    }

    const row = await db.$transaction(async (tx) => {
      const announcement = await tx.announcement.create({
        data: {
          organizationId: org.organizationId,
          senderMemberId: org.memberId!,
          title: input.title,
          body: input.body,
          targetType: input.targetType,
          targetIds,
        },
      });
      await this.audit.record(
        audit,
        {
          action: 'announcement.sent',
          entityType: 'announcement',
          entityId: announcement.id,
          after: {
            targetType: input.targetType,
            recipientCount: previewIdentities.length,
          },
        },
        tx,
      );
      await emit(tx, audit, {
        type: 'announcement.sent',
        aggregateType: 'announcement',
        aggregateId: announcement.id,
        payload: { announcementId: announcement.id },
      });
      return announcement;
    });

    return {
      id: row.id,
      title: row.title,
      body: row.body,
      targetType: row.targetType,
      targetIds: targetIdsFromAnnouncement(row),
      senderMemberId: row.senderMemberId,
      createdAt: row.createdAt.toISOString(),
      recipientCount: previewIdentities.length,
    };
  }
}
