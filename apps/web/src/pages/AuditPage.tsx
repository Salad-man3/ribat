import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { AuditLogResponse } from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { Button } from '../components/ui/button';
import {
  Badge,
  Card,
  Empty,
  ErrorText,
  PageHeader,
} from '../components/ui/form';

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
      <PageHeader title={t('audit.title')} subtitle={t('audit.subtitle')} />
      {audit.isError ? <ErrorText error={audit.error} /> : null}
      <Card>
        {audit.isSuccess && rows.length === 0 ? (
          <Empty>{t('audit.empty')}</Empty>
        ) : null}
        <ul className="divide-y divide-line">
          {rows.map((row) => (
            <li key={row.id} className="py-3 text-sm">
              <details>
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span dir="ltr" className="font-mono text-xs font-medium">
                      {row.action}
                    </span>
                    <Badge>{row.entityType}</Badge>
                  </span>
                  <time className="text-xs text-muted">
                    {new Date(row.createdAt).toLocaleString(i18n.language)}
                  </time>
                </summary>
                <pre
                  dir="ltr"
                  className="mt-2 overflow-x-auto rounded-lg bg-paper p-3 text-xs"
                >
                  {JSON.stringify(
                    {
                      before: row.before,
                      after: row.after,
                      requestId: row.requestId,
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
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
