import { Injectable } from '@nestjs/common';
import type { Notification } from '@prisma/client';
import type {
  ListNotificationsQuery,
  MarkNotificationsReadInput,
  NotificationResponse,
  NotificationsResponse,
} from '@ribat/shared';
import { PrismaService } from '../prisma/prisma.service';

function toNotificationResponse(row: Notification): NotificationResponse {
  return {
    id: row.id,
    type: row.type,
    titleKey: row.titleKey,
    bodyKey: row.bodyKey,
    params: row.params as Record<string, unknown>,
    entityType: row.entityType,
    entityId: row.entityId,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** T406: the in-app inbox. A person only ever reads their own rows. */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    organizationId: string,
    identityId: string,
    query: ListNotificationsQuery,
  ): Promise<NotificationsResponse> {
    const db = this.prisma.forOrganization(organizationId);
    const mine = { recipientIdentityId: identityId };
    const [items, unread] = await Promise.all([
      db.notification.findMany({
        where: mine,
        // Unread first, newest first within each.
        orderBy: [{ readAt: { sort: 'desc', nulls: 'first' } }, { createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
      db.notification.count({ where: { ...mine, readAt: null } }),
    ]);
    return { items: items.map(toNotificationResponse), unread };
  }

  async markRead(organizationId: string, identityId: string, input: MarkNotificationsReadInput): Promise<void> {
    await this.prisma.forOrganization(organizationId).notification.updateMany({
      where: {
        recipientIdentityId: identityId,
        readAt: null,
        ...(input.ids ? { id: { in: input.ids } } : {}),
      },
      data: { readAt: new Date() },
    });
  }
}
