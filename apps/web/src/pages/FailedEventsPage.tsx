import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { FailedDeliveryResponse } from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { Button } from '../components/ui/button';
import { Badge, Empty, ErrorText, PageHeader } from '../components/ui/form';
import { formatDateTime } from '../lib/domain';

/** T411, EV-05: a reaction that kept failing is visible here and can be retried. */
export function FailedEventsPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const failed = useQuery({
    queryKey: ['events', 'failed'],
    queryFn: () => apiFetch<FailedDeliveryResponse[]>('/api/v1/events/failed'),
  });
  const retry = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/events/deliveries/${id}/retry`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events', 'failed'] }),
  });

  return (
    <section className="grid gap-6">
      <PageHeader
        chrome
        title={t('events.title')}
        subtitle={t('events.subtitle')}
      />
      {failed.isError ? <ErrorText error={failed.error} /> : null}
      {retry.isError ? <ErrorText error={retry.error} /> : null}
      {failed.data?.length === 0 ? <Empty>{t('events.empty')}</Empty> : null}
      <ul className="grid gap-2">
        {(failed.data ?? []).map((d) => (
          <li key={d.id} className="grid gap-2 rounded-2xl border border-line bg-surface p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs" dir="ltr">{d.eventType} → {d.handler}</span>
              <Badge tone={d.status === 'DEAD' ? 'danger' : 'neutral'}>
                {t(`events.status.${d.status}`)} · {t('events.attempts', { count: d.attempts })}
              </Badge>
            </div>
            {d.lastError ? <code className="block truncate text-xs text-danger" dir="ltr">{d.lastError}</code> : null}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
              <span>
                {formatDateTime(d.occurredAt, i18n.language)}
                {d.requestId ? <> · <span dir="ltr">{d.requestId}</span></> : null}
              </span>
              <Button variant="ghost" onClick={() => retry.mutate(d.id)} disabled={retry.isPending}>
                {t('events.retry')}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
