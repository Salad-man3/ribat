import type { NotificationType, Prisma } from '@prisma/client';
import type { OrgTx } from '../prisma/prisma.service';

type Db = Pick<OrgTx, 'membership' | 'guardianLink' | 'notification'>;

/** The logins that act as these members. A guardian with no login simply gets nothing (decision 14.3). */
export async function identitiesOf(db: Db, memberIds: string[]): Promise<string[]> {
  if (memberIds.length === 0) return [];
  const rows = await db.membership.findMany({
    where: { memberId: { in: memberIds }, status: 'ACTIVE' },
    select: { identityId: true },
  });
  return [...new Set(rows.map((r) => r.identityId))];
}

/** Each member plus their guardians (decision 15.2). */
export async function withGuardians(db: Db, memberIds: string[]): Promise<string[]> {
  if (memberIds.length === 0) return [];
  const links = await db.guardianLink.findMany({
    where: { wardMemberId: { in: memberIds } },
    select: { guardianMemberId: true },
  });
  return [...new Set([...memberIds, ...links.map((l) => l.guardianMemberId)])];
}

export type NotificationDraft = {
  type: NotificationType;
  params: Record<string, Prisma.InputJsonValue | null>;
  entityType?: string;
  entityId?: string;
};

/**
 * Stores keys and parameters, never finished sentences (NFR-01). `dedupeKey` + the unique
 * index make every producer safe to run twice: the second insert is skipped (EV-03).
 */
export async function notify(
  db: Db,
  organizationId: string,
  recipients: string[],
  draft: NotificationDraft,
  dedupeKey: string,
): Promise<number> {
  if (recipients.length === 0) return 0;
  const { count } = await db.notification.createMany({
    data: [...new Set(recipients)].map((recipientIdentityId) => ({
      organizationId,
      recipientIdentityId,
      type: draft.type,
      titleKey: `notifications.${draft.type}.title`,
      bodyKey: `notifications.${draft.type}.body`,
      params: draft.params,
      entityType: draft.entityType ?? null,
      entityId: draft.entityId ?? null,
      dedupeKey: `${dedupeKey}:${recipientIdentityId}`,
    })),
    skipDuplicates: true,
  });
  return count;
}
