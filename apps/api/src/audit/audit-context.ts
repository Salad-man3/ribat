export type AuditContext = {
  organizationId: string;
  actorIdentityId: string | null;
  actorMembershipId: string | null;
  requestId?: string | null;
};

export type AuditEventInput = {
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
};

export function requestIdFrom(req: { id?: string; requestId?: string; header?: (name: string) => string | undefined }): string | undefined {
  return req.id ?? req.requestId ?? req.header?.('x-request-id') ?? undefined;
}

export function auditContextFromOrg(
  org: { organizationId: string; membershipId: string },
  identityId: string,
  requestId?: string,
): AuditContext {
  return {
    organizationId: org.organizationId,
    actorIdentityId: identityId,
    actorMembershipId: org.membershipId,
    requestId,
  };
}
