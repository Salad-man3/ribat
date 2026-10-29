import { Injectable } from '@nestjs/common';
import type { Notification } from '@prisma/client';
import type {
  ListNotificationsQuery,
  MarkNotificationsReadInput,
  NotificationCategory,
  NotificationCategoryCounts,
  NotificationResponse,
  NotificationsResponse,
  NotificationType,
} from '@ribat/shared';
import { notificationCategory } from '@ribat/shared';
import { PrismaService } from '../prisma/prisma.service';

const EMPTY_COUNTS: NotificationCategoryCounts = {
  attendance: 0,
  homework: 0,
  progress: 0,
  schedule: 0,
  announcements: 0,
};

const TYPES_FOR_CATEGORY: Record<NotificationCategory, NotificationType[]> = {
  attendance: ['ABSENCE_SUMMARY', 'ATTENDANCE_OVERRIDDEN', 'EXCUSE_DECIDED'],
  homework: ['HOMEWORK_ASSIGNED', 'HOMEWORK_MISSED'],
  progress: ['TEST_RESULT'],
  schedule: ['SCHEDULE_CHANGE', 'SESSION_NOT_TAKEN'],
  announcements: ['ANNOUNCEMENT'],
};

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
    const categoryTypes = query.category
      ? TYPES_FOR_CATEGORY[query.category]
      : undefined;
    const listWhere = {
      ...mine,
      ...(categoryTypes ? { type: { in: categoryTypes } } : {}),
    };
    const [items, unread, unreadRows] = await Promise.all([
      db.notification.findMany({
        where: listWhere,
        // Unread first, newest first within each.
        orderBy: [{ readAt: { sort: 'desc', nulls: 'first' } }, { createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
      db.notification.count({ where: { ...mine, readAt: null } }),
      db.notification.findMany({
        where: { ...mine, readAt: null },
        select: { type: true },
      }),
    ]);
    const unreadByCategory = { ...EMPTY_COUNTS };
    for (const row of unreadRows) {
      unreadByCategory[notificationCategory(row.type)] += 1;
    }
    return {
      items: items.map(toNotificationResponse),
      unread,
      unreadByCategory,
    };
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
