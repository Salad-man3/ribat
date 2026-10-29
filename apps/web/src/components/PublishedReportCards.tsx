import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { ReportCardResponse } from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { Card, Empty } from './ui/form';
import { formatGregorianNumeric } from '../lib/domain';

export function PublishedReportCards({
  memberId,
  basePath,
}: {
  memberId: string;
  basePath: '/member' | '/guardian';
}) {
  const { t } = useTranslation();
  const cards = useQuery({
    queryKey: ['report-cards', memberId, 'published'],
    queryFn: () =>
      apiFetch<ReportCardResponse[]>(
        `/api/v1/report-cards?memberId=${memberId}&status=PUBLISHED`,
      ),
  });
  if (!cards.data?.length) return null;
  return (
    <Card title={t('reportCards.published')}>
      {cards.data.length === 0 ? (
        <Empty>{t('reportCards.empty')}</Empty>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {cards.data.map((c) => (
            <li key={c.id} className="py-2">
              <Link to={`${basePath}/reports/cards/${c.id}`} className="font-medium hover:text-accent">
                {c.courseName ?? t('reportCards.allCourses')}
              </Link>
              <p className="text-xs text-muted">
                {formatGregorianNumeric(c.periodStart)} – {formatGregorianNumeric(c.periodEnd)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
