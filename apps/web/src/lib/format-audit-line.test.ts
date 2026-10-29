import { describe, expect, it } from 'vitest';
import type { AuditLogResponse } from '@ribat/shared';
import type { TFunction } from 'i18next';
import { formatAuditLine } from './format-audit-line';

const t = ((key: string, opts?: Record<string, string>) => {
  const table: Record<string, string> = {
    'audit.unknownActor': 'Someone',
    'audit.unknownTarget': '—',
    'audit.actions._fallback': `${opts?.actor ?? ''} — ${opts?.action ?? ''}`,
    'audit.actions.course.created': `${opts?.actor} created halaqa «${opts?.target}»`,
    'audit.actions.teacher.assigned_ctx': `${opts?.actor} assigned ${opts?.target} to «${opts?.context}»`,
  };
  return table[key] ?? opts?.defaultValue ?? key;
}) as TFunction;

const row = (
  patch: Partial<AuditLogResponse> & Pick<AuditLogResponse, 'action'>,
): AuditLogResponse => ({
  id: '00000000-0000-0000-0000-000000000001',
  organizationId: '00000000-0000-0000-0000-000000000002',
  actorIdentityId: null,
  actorMembershipId: null,
  actorName: 'Ahmad',
  targetName: 'Fajr circle',
  contextName: null,
  entityType: 'course',
  entityId: '00000000-0000-0000-0000-000000000003',
  before: null,
  after: null,
  requestId: null,
  createdAt: '2026-10-26T00:00:00.000Z',
  ...patch,
});

describe('formatAuditLine', () => {
  it('uses a plain sentence with actor and halaqa name', () => {
    expect(formatAuditLine(row({ action: 'course.created' }), t)).toBe(
      'Ahmad created halaqa «Fajr circle»',
    );
  });

  it('uses the context sentence when a halaqa is attached', () => {
    expect(
      formatAuditLine(
        row({
          action: 'teacher.assigned',
          targetName: 'Mahmoud',
          contextName: 'Fajr circle',
        }),
        t,
      ),
    ).toBe('Ahmad assigned Mahmoud to «Fajr circle»');
  });
});
