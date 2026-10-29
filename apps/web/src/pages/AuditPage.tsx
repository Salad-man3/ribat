import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { AuditLogResponse } from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { Button } from '../components/ui/button';
import {
  Card,
  Empty,
  ErrorText,
  PageHeader,
} from '../components/ui/form';
import { formatAuditLine } from '../lib/format-audit-line';
import { formatDateTime } from '../lib/domain';

const PAGE = 50;

export function AuditPage() {
  const { t, i18n } = useTranslation();
  const audit = useInfiniteQuery({
    queryKey: ['audit'],
    initialPageParam: '',
    queryFn: ({ pageParam }) =>
      apiFetch<AuditLogResponse[]>(
        `/api/v1/audit?limit=${PAGE}${pageParam ? `&cursor=${pageParam}` : ''}`,
      ),
    getNextPageParam: (last) =>
      last.length === PAGE ? last[last.length - 1].id : undefined,
  });
  const rows = audit.data?.pages.flat() ?? [];

  return (
    <section className="grid gap-6">
      <PageHeader
        chrome
        title={t('audit.title')}
        subtitle={t('audit.subtitle')}
      />
      {audit.isError ? <ErrorText error={audit.error} /> : null}
      <Card>
        {audit.isSuccess && rows.length === 0 ? (
          <Empty>{t('audit.empty')}</Empty>
        ) : null}
        <ul className="divide-y divide-line">
          {rows.map((row) => (
            <li key={row.id} className="py-3 text-sm">
              <p className="font-medium leading-snug text-ink">
                {formatAuditLine(row, t)}
              </p>
              <time className="mt-1 block text-xs text-muted">
                {formatDateTime(row.createdAt, i18n.language)}
              </time>
            </li>
          ))}
        </ul>
        {audit.hasNextPage ? (
          <Button
            variant="ghost"
            className="mt-3"
            onClick={() => void audit.fetchNextPage()}
            disabled={audit.isFetchingNextPage}
          >
            {t('audit.loadMore')}
          </Button>
        ) : null}
      </Card>
    </section>
  );
}
