import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useProgress } from './family';
import { NavButton } from './ui/nav-button';
import { Card, Empty, ErrorText } from './ui/form';
import { useActiveMembership } from '../hooks/use-me';

function pct(rate: number | null) {
  return rate == null ? '—' : `${Math.round(rate * 100)}%`;
}

function CourseMetrics({
  type,
  pagesMemorized,
  pagesHeard,
  explanationPercent,
  mode,
}: {
  type: string;
  pagesMemorized?: number;
  pagesHeard?: number;
  explanationPercent: number | null;
  mode: 'study' | 'teach';
}) {
  const { t } = useTranslation();
  const showHifz = type === 'MEMORIZATION' || type === 'BOTH';
  const showExplain = type === 'EXPLANATION' || type === 'BOTH';
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
      {mode === 'study' && showHifz ? (
        <li>
          {t('memberOverview.pagesMemorized', { count: pagesMemorized ?? 0 })}
        </li>
      ) : null}
      {mode === 'teach' && showHifz ? (
        <li>{t('memberOverview.pagesHeard', { count: pagesHeard ?? 0 })}</li>
      ) : null}
      {showExplain && explanationPercent != null ? (
        <li>
          {t('memberOverview.explanationPercent', { pct: explanationPercent })}
        </li>
      ) : null}
    </ul>
  );
}

export function MemberHalaqatOverview({ memberId }: { memberId: string }) {
  const { t } = useTranslation();
  const { can } = useActiveMembership();
  const progress = useProgress(memberId);
  const staffCourse = can('courses.manage') || can('members.manage');

  if (progress.isError) return <ErrorText error={progress.error} />;
  const p = progress.data;
  if (!p) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CourseListCard
        title={t('memberOverview.studying')}
        empty={t('memberOverview.noStudying')}
        rows={(p.courses ?? []).filter((c) => c.enrollmentStatus === 'ACTIVE')}
        renderRow={(c) => (
          <li
            key={c.courseId}
            className="grid gap-1 rounded-lg bg-paper px-3 py-2 text-sm"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              {staffCourse ? (
                <NavButton
                  to={`/staff/courses/${c.courseId}`}
                  className="font-medium text-accent"
                >
                  {c.courseName}
                </NavButton>
              ) : (
                <span className="font-medium">{c.courseName}</span>
              )}
              <span className="text-lg font-semibold text-accent">
                {pct(c.attendance?.rate ?? null)}
              </span>
            </div>
            <span className="text-xs text-muted">
              {t('memberOverview.attendance')}
            </span>
            <CourseMetrics
              type={c.type}
              pagesMemorized={c.pagesMemorized}
              explanationPercent={c.explanationPercent}
              mode="study"
            />
          </li>
        )}
      />
      <CourseListCard
        title={t('memberOverview.teaching')}
        empty={t('memberOverview.noTeaching')}
        rows={p.teaching ?? []}
        renderRow={(c) => (
          <li
            key={c.courseId}
            className="grid gap-1 rounded-lg bg-paper px-3 py-2 text-sm"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              {staffCourse ? (
                <NavButton
                  to={`/staff/courses/${c.courseId}`}
                  className="font-medium text-accent"
                >
                  {c.courseName}
                </NavButton>
              ) : (
                <span className="font-medium">{c.courseName}</span>
              )}
              <span className="text-lg font-semibold text-accent">
                {c.studentCount}
              </span>
            </div>
            <span className="text-xs text-muted">
              {t('memberOverview.students')}
            </span>
            <CourseMetrics
              type={c.type}
              pagesHeard={c.pagesHeard}
              explanationPercent={c.explanationPercent}
              mode="teach"
            />
          </li>
        )}
      />
    </div>
  );
}

function CourseListCard<T>({
  title,
  empty,
  rows,
  renderRow,
}: {
  title: string;
  empty: string;
  rows: T[] | undefined;
  renderRow: (row: T) => ReactNode;
}) {
  const list = rows ?? [];
  return (
    <Card title={title}>
      {list.length === 0 ? <Empty>{empty}</Empty> : null}
      <ul className="grid gap-2">{list.map(renderRow)}</ul>
    </Card>
  );
}
