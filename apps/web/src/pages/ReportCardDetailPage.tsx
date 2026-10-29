import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import type { ReportCardResponse } from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { Card, Empty, ErrorText, Field, PageHeader, inputClass } from '../components/ui/form';
import { Button } from '../components/ui/button';
import { useActiveMembership } from '../hooks/use-me';
import { formatGregorianNumeric } from '../lib/domain';
import { reportCardWhatsappUrl } from '../lib/report-card-share';

export function ReportCardDetailPage({ listPath }: { listPath: string }) {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { can } = useActiveMembership();
  const qc = useQueryClient();
  const staff = can('courses.manage');

  const card = useQuery({
    queryKey: ['report-card', id],
    queryFn: () => apiFetch<ReportCardResponse>(`/api/v1/report-cards/${id}`),
    enabled: !!id,
  });

  const [comment, setComment] = useState('');
  useEffect(() => {
    setComment(card.data?.teacherComment ?? '');
  }, [card.data?.teacherComment]);

  const saveComment = useMutation({
    mutationFn: () =>
      apiFetch<ReportCardResponse>(`/api/v1/report-cards/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ teacherComment: comment || null }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['report-card', id] }),
  });

  const publish = useMutation({
    mutationFn: () =>
      apiFetch<ReportCardResponse>(`/api/v1/report-cards/${id}/publish`, { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['report-card', id] });
      void qc.invalidateQueries({ queryKey: ['report-cards'] });
    },
  });

  if (card.isLoading) return null;
  if (card.error) return <ErrorText error={card.error} />;
  if (!card.data) return <Empty>{t('reportCards.notFound')}</Empty>;

  const c = card.data;
  const content = c.content;
  const rate =
    content.attendanceRate === null
      ? '—'
      : new Intl.NumberFormat(i18n.language, { style: 'percent', maximumFractionDigits: 0 }).format(
          content.attendanceRate,
        );

  const shareUrl = `${window.location.origin}${listPath}/cards/${c.id}`;
  const waUrl = reportCardWhatsappUrl(shareUrl, t('reportCards.shareMessage'));

  return (
    <section className="grid gap-6">
      <PageHeader
        title={t('reportCards.viewTitle', { name: c.memberName })}
        subtitle={`${formatGregorianNumeric(c.periodStart)} – ${formatGregorianNumeric(c.periodEnd)}`}
      />
      <Link to={listPath} className="text-sm text-accent">
        ← {t('stats.title')}
      </Link>

      <Card title={c.courseName ?? t('reportCards.allCourses')}>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">{t('reportCards.attendance')}</dt>
            <dd className="font-semibold">{rate}</dd>
          </div>
          <div>
            <dt className="text-muted">{t('stats.pagesThisWeek')}</dt>
            <dd className="font-semibold">{content.pagesMemorized}</dd>
          </div>
          <div>
            <dt className="text-muted">{t('reportCards.homework')}</dt>
            <dd className="font-semibold">
              {content.homeworkDone} / {content.homeworkAssigned}
            </dd>
          </div>
          <div>
            <dt className="text-muted">{t('reportCards.tests')}</dt>
            <dd className="font-semibold">
              {content.tests.filter((x) => x.passed).length} / {content.tests.length}
            </dd>
          </div>
        </dl>
        {content.tests.length > 0 ? (
          <ul className="mt-4 divide-y divide-line text-sm">
            {content.tests.map((test) => (
              <li key={test.testId} className="py-2">
                {test.score}% · {test.passed ? t('reportCards.passed') : t('reportCards.notPassed')}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      {c.status === 'DRAFT' ? (
        <Card title={t('reportCards.teacherComment')}>
          <Field label={t('reportCards.commentLabel')}>
            <textarea
              className={inputClass}
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </Field>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" onClick={() => saveComment.mutate()} disabled={saveComment.isPending}>
              {t('reportCards.saveComment')}
            </Button>
            {staff ? (
              <Button type="button" variant="ghost" onClick={() => publish.mutate()} disabled={publish.isPending}>
                {t('reportCards.publish')}
              </Button>
            ) : null}
          </div>
        </Card>
      ) : (
        <>
          {c.teacherComment ? (
            <Card title={t('reportCards.teacherComment')}>
              <p className="whitespace-pre-wrap text-sm">{c.teacherComment}</p>
            </Card>
          ) : null}
          <a href={waUrl} target="_blank" rel="noreferrer" className="inline-flex">
            <Button type="button">{t('reportCards.shareWhatsapp')}</Button>
          </a>
        </>
      )}
    </section>
  );
}
