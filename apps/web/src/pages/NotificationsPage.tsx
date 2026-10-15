import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NotificationsResponse } from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { Button } from '../components/ui/button';
import { Empty, ErrorText, PageHeader } from '../components/ui/form';
import { formatDate, formatDateTime } from '../lib/domain';
import { cn } from '../lib/utils';

export const notificationsKey = ['notifications'];

export function useNotifications() {
  return useQuery({
    queryKey: notificationsKey,
    queryFn: () => apiFetch<NotificationsResponse>('/api/v1/notifications'),
    refetchInterval: 60_000,
  });
}

/** T406: rendered in the reader's language from keys and params (NFR-01). */
export function NotificationsPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const inbox = useNotifications();
  const markAll = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/notifications/read', { method: 'POST', body: JSON.stringify({ all: true }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationsKey }),
  });

  return (
    <section className="grid gap-6">
      <PageHeader
        title={t('notifications.title')}
        actions={
          inbox.data?.unread ? (
            <Button variant="ghost" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
              {t('notifications.markAll')}
            </Button>
          ) : null
        }
      />
      {inbox.isError ? <ErrorText error={inbox.error} /> : null}
      {inbox.data?.items.length === 0 ? <Empty>{t('notifications.empty')}</Empty> : null}
      <ul className="grid gap-2">
        {(inbox.data?.items ?? []).map((n) => {
          const day = (v: unknown) => (typeof v === 'string' ? formatDate(v, i18n.language) : v);
          const items = Array.isArray(n.params.items)
            ? (n.params.items as { student: string; course: string; status: string }[])
                .map((i) => `${i.student} — ${i.course}: ${t(`classMode.status.${i.status}`)}`)
                .join('\n')
            : undefined;
          const params = {
            ...n.params,
            items,
            date: day(n.params.date),
            dueDate: day(n.params.dueDate),
            fromDate: day(n.params.fromDate),
            toDate: day(n.params.toDate),
            status: typeof n.params.status === 'string' ? t(`classMode.status.${n.params.status}`) : undefined,
            decision: typeof n.params.decision === 'string' ? t(`excuses.status.${n.params.decision}`) : undefined,
            result: n.params.passed === undefined ? undefined : t(n.params.passed ? 'notifications.passed' : 'notifications.failed'),
          };
          return (
            <li
              key={n.id}
              className={cn(
                'grid gap-1 rounded-2xl border bg-surface p-4',
                n.readAt ? 'border-line' : 'border-accent',
              )}
            >
              <p className="font-semibold">{t(n.titleKey, params)}</p>
              <p className="whitespace-pre-line text-sm">{t(n.bodyKey, params)}</p>
              <p className="text-xs text-muted">{formatDateTime(n.createdAt, i18n.language)}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
