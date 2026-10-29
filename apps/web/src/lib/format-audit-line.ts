import type { AuditLogResponse } from '@ribat/shared';
import type { TFunction } from 'i18next';

function payloadStatus(row: AuditLogResponse): string | undefined {
  const after = row.after;
  if (after && typeof after === 'object' && !Array.isArray(after)) {
    const status = (after as { status?: unknown }).status;
    if (typeof status === 'string') return status;
  }
  return undefined;
}

function fill(
  t: TFunction,
  key: string,
  vars: Record<string, string>,
): string | null {
  const missing = '__missing__';
  const line = t(key, { ...vars, defaultValue: missing });
  if (!line || line === missing || line === key) return null;
  return line;
}

export function formatAuditLine(row: AuditLogResponse, t: TFunction): string {
  const actor = row.actorName ?? t('audit.unknownActor');
  const target = row.targetName ?? t('audit.unknownTarget');
  const context = row.contextName ?? '';
  const status = payloadStatus(row);
  const statusLabel = status ? t(`courses.status.${status}`) : '';
  const vars = { actor, target, context, status: statusLabel };

  const keys = [
    row.contextName ? `audit.actions.${row.action}_ctx` : null,
    `audit.actions.${row.action}`,
  ].filter((k): k is string => Boolean(k));

  for (const key of keys) {
    const line = fill(t, key, vars);
    if (line) return line;
  }
  return t('audit.actions._fallback', {
    actor,
    action: row.action,
  });
}
