import type { AuditContext } from '../audit/audit-context';
import type { OrgTx } from '../prisma/prisma.service';

/** 07-events-and-jobs §4, the beta subset. */
export type EventType =
  | 'attendance.marked'
  | 'memorization.logged'
  | 'test.recorded'
  | 'homework.assigned'
  | 'homework.missed'
  | 'session.cancelled'
  | 'excuse.decided'
  | 'member.archived'
  | 'announcement.sent'
  | 'report.published';

/** EV-07: IDs and facts only. A handler loads names when it needs them. */
export type EventPayload = Record<string, string | number | boolean | null>;

export type DomainEventInput = {
  type: EventType;
  aggregateType: string;
  aggregateId: string;
  payload: EventPayload;
};

/**
 * EV-02: the event row commits or rolls back with the change it describes, because it is
 * written with the caller's transaction client. EV-06: it carries the request id.
 */
export async function emit(
  tx: Pick<OrgTx, 'domainEvent'>,
  ctx: Pick<AuditContext, 'organizationId' | 'requestId' | 'actorMembershipId'>,
  event: DomainEventInput,
): Promise<void> {
  await tx.domainEvent.create({
    data: {
      organizationId: ctx.organizationId,
      type: event.type,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      payload: event.payload,
      requestId: ctx.requestId ?? null,
      actorMembershipId: ctx.actorMembershipId ?? null,
    },
  });
}
