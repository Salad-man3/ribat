import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ExcuseResponse } from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { Button } from '../components/ui/button';
import { Badge, Empty, ErrorText, PageHeader } from '../components/ui/form';
import { formatDate } from '../lib/domain';

/** WF-08: staff accept or reject; accepting turns matching marks into EXCUSED (decision 8.3). */
export function ExcusesPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const excuses = useQuery({
    queryKey: ['excuses'],
    queryFn: () => apiFetch<ExcuseResponse[]>('/api/v1/excuses'),
  });
  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'ACCEPTED' | 'REJECTED' }) =>
      apiFetch(`/api/v1/excuses/${id}/decision`, { method: 'POST', body: JSON.stringify({ decision }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['excuses'] }),
  });

  return (
    <section className="grid gap-6">
      <PageHeader
        chrome
        title={t('excuses.title')}
        subtitle={t('excuses.subtitle')}
      />
      {excuses.isError ? <ErrorText error={excuses.error} /> : null}
      {decide.isError ? <ErrorText error={decide.error} /> : null}
      {excuses.data?.length === 0 ? <Empty>{t('excuses.empty')}</Empty> : null}
      <ul className="grid gap-2">
        {(excuses.data ?? []).map((x) => (
          <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
            <div className="grid gap-1">
              <span className="font-semibold">{x.memberName}</span>
              <span className="text-sm text-muted">
                {formatDate(x.fromDate, i18n.language)}
                {x.toDate !== x.fromDate ? ` – ${formatDate(x.toDate, i18n.language)}` : ''}
                {x.courseName ? ` · ${x.courseName}` : ''}
              </span>
              <span className="text-sm">{x.reason}</span>
            </div>
            {x.status === 'PENDING' ? (
              <div className="flex gap-2">
                <Button onClick={() => decide.mutate({ id: x.id, decision: 'ACCEPTED' })} disabled={decide.isPending}>
                  {t('excuses.accept')}
                </Button>
                <Button variant="ghost" onClick={() => decide.mutate({ id: x.id, decision: 'REJECTED' })} disabled={decide.isPending}>
                  {t('excuses.reject')}
                </Button>
              </div>
            ) : (
              <Badge tone={x.status === 'ACCEPTED' ? 'accent' : 'danger'}>{t(`excuses.status.${x.status}`)}</Badge>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
