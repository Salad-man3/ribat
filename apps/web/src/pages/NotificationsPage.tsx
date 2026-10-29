import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  NotificationCategory,
  NotificationsResponse,
} from '@ribat/shared';

const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  'attendance',
  'homework',
  'progress',
  'schedule',
  'announcements',
];
import { apiFetch } from '../api/api-fetch';
import { AnnouncementComposer } from '../components/AnnouncementComposer';
import { Button } from '../components/ui/button';
import { Empty, ErrorText, PageHeader } from '../components/ui/form';
import { formatDate, formatDateTime } from '../lib/domain';
import { cn } from '../lib/utils';

export const notificationsKey = ['notifications'];

function notificationsUrl(category: NotificationCategory | null) {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  const q = params.toString();
  return `/api/v1/notifications${q ? `?${q}` : ''}`;
}

export function useNotifications(category: NotificationCategory | null) {
  return useQuery({
    queryKey: [...notificationsKey, category ?? 'all'],
    queryFn: () => apiFetch<NotificationsResponse>(notificationsUrl(category)),
    refetchInterval: 60_000,
  });
}

/** T406: rendered in the reader's language from keys and params (NFR-01). */
export function NotificationsPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<NotificationCategory | null>(null);
  const inbox = useNotifications(category);
  const counts = useNotifications(null);
  const markAll = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/notifications/read', { method: 'POST', body: JSON.stringify({ all: true }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationsKey }),
  });

  return (
    <section className="grid gap-6">
      <PageHeader
        chrome
        title={t('notifications.title')}
        actions={
          inbox.data?.unread ? (
            <Button variant="ghost" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
              {t('notifications.markAll')}
            </Button>
          ) : null
        }
      />
      <AnnouncementComposer />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={cn(
            'rounded-full border px-3 py-1 text-sm',
            category === null ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted',
          )}
          onClick={() => setCategory(null)}
        >
          {t('notifications.categories.all')}
          {counts.data?.unread ? ` (${counts.data.unread})` : ''}
        </button>
        {NOTIFICATION_CATEGORIES.map((key) => {
          const unread = counts.data?.unreadByCategory[key] ?? 0;
          return (
            <button
              key={key}
              type="button"
              className={cn(
                'rounded-full border px-3 py-1 text-sm',
                category === key ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted',
              )}
              onClick={() => setCategory(key)}
            >
              {t(`notifications.categories.${key}`)}
              {unread ? ` (${unread})` : ''}
            </button>
          );
        })}
      </div>
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
          const announcementTitle =
            n.type === 'ANNOUNCEMENT' && typeof n.params.title === 'string'
              ? n.params.title
              : undefined;
          const announcementBody =
            n.type === 'ANNOUNCEMENT' && typeof n.params.body === 'string'
              ? n.params.body
              : undefined;
          const params = {
            ...n.params,
            title: announcementTitle ?? n.params.title,
            body: announcementBody ?? n.params.body,
            items,
            date: day(n.params.date),
            dueDate: day(n.params.dueDate),
            fromDate: day(n.params.fromDate),
            toDate: day(n.params.toDate),
            status: typeof n.params.status === 'string' ? t(`classMode.status.${n.params.status}`) : undefined,
            decision: typeof n.params.decision === 'string' ? t(`excuses.status.${n.params.decision}`) : undefined,
            result: n.params.passed === undefined ? undefined : t(n.params.passed ? 'notifications.passed' : 'notifications.failed'),
          };
          const titleText = announcementTitle ?? t(n.titleKey, params);
          const bodyText = announcementBody ?? t(n.bodyKey, params);
          return (
            <li
              key={n.id}
              className={cn(
                'grid gap-1 rounded-2xl border bg-surface p-4',
                n.readAt ? 'border-line' : 'border-accent',
              )}
            >
              <p className="font-semibold">{titleText}</p>
              <p className="whitespace-pre-line text-sm">{bodyText}</p>
              <p className="text-xs text-muted">{formatDateTime(n.createdAt, i18n.language)}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
