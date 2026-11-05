import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { useLobbyWeekSchedule, useProgress } from '../components/family';
import { HifzMap } from '../components/HifzMap';
import { NavButton } from '../components/ui/nav-button';
import {
  Badge,
  Card,
  Empty,
  ErrorText,
  Segmented,
} from '../components/ui/form';
import { useFormatDates } from '../lib/calendar';
import { formatTimeRange } from '../lib/domain';
import { cn } from '../lib/utils';
import { useActiveMembership } from '../hooks/use-me';
import { NotFoundPage } from './NotFoundPage';

type StudyMode = 'attendance' | 'hifz';

/** Read-only view of the member’s attendance and hifz for one enrolled session. */
export function MemberStudySessionPage() {
  const { id: sessionId = '' } = useParams();
  const { t, i18n } = useTranslation();
  const { formatDate } = useFormatDates();
  const { membership } = useActiveMembership();
  const { schedule } = useLobbyWeekSchedule();
  const progress = useProgress(membership?.memberId);
  const [mode, setMode] = useState<StudyMode>('attendance');

  const entry = schedule.data?.entries.find(
    (e) => e.sessionId === sessionId && e.role === 'STUDYING',
  );

  if (schedule.isError) return <ErrorText error={schedule.error} />;
  if (schedule.isPending || progress.isPending) return null;
  if (!entry || !membership?.memberId) return <NotFoundPage />;

  const p = progress.data;
  const course =
    p?.courses.find((c) => c.courseId === entry.courseId) ??
    p?.courses.find((c) => c.courseName === entry.courseName);
  const recent = (p?.recentAttendance ?? []).filter(
    (a) => a.courseName === entry.courseName,
  );

  const PILL = {
    PRESENT: 'bg-accent-soft text-accent-strong',
    LATE: 'bg-gold/20 text-ink',
    ABSENT: 'bg-danger-soft text-danger',
    EXCUSED: 'border border-line text-muted',
  } as const;

  return (
    <section className="grid gap-4">
      <NavButton to="/member" className="text-sm text-accent">
        <span className="inline-block rtl:rotate-180">←</span> {t('nav.member')}
      </NavButton>
      <div>
        <h1 className="text-2xl font-bold">{entry.courseName}</h1>
        <p className="text-sm text-muted">
          {formatDate(entry.date)} ·{' '}
          {formatTimeRange(
            entry.startsAt,
            entry.endsAt,
            i18n.language,
            schedule.data?.timezone,
          )}
        </p>
      </div>
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'attendance', label: t('classMode.attendance') },
          { value: 'hifz', label: t('classMode.hifz') },
        ]}
        aria-label={t('classMode.sessionMode')}
      />
      {progress.isError ? <ErrorText error={progress.error} /> : null}
      {mode === 'attendance' ? (
        <Card title={t('family.attendance')}>
          {!course ? <Empty>{t('family.noCourses')}</Empty> : null}
          {course ? (
            <p className="text-sm">
              <span className="text-muted">{t('family.attendance')}:</span>{' '}
              <span className="text-2xl font-semibold text-accent">
                {course.attendance.rate === null
                  ? '—'
                  : `${Math.round(course.attendance.rate * 100)}%`}
              </span>
            </p>
          ) : null}
          {recent.length === 0 ? (
            <Empty>{t('member.studyNoAttendance')}</Empty>
          ) : (
            <ul className="mt-3 text-sm">
              {recent.slice(0, 12).map((a, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-2 border-b border-line py-2 last:border-0"
                >
                  <span>{formatDate(a.date)}</span>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-xs font-medium',
                      PILL[a.status],
                    )}
                  >
                    {t(`classMode.status.${a.status}`)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <Card title={t('family.memorization')}>
          {p?.hifz ? <HifzMap hifz={p.hifz} /> : null}
          {!p?.summaries.length ? (
            <Empty>{t('classMode.noPosition')}</Empty>
          ) : (
            <ul className="grid gap-2 text-sm">
              {p.summaries.map((s) => (
                <li
                  key={s.materialId}
                  className="grid gap-1 rounded-lg bg-paper px-3 py-2"
                >
                  <span className="font-medium">{s.materialTitle}</span>
                  <span className="text-xs text-muted">
                    {t('family.pages', { count: s.pagesMemorized })}
                    {s.lastPageReached
                      ? ` · ${t('classMode.lastPage', { page: s.lastPageReached })}`
                      : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {p?.tests.length ? (
            <>
              <h3 className="mt-4 mb-2 text-sm font-semibold">
                {t('family.tests')}
              </h3>
              <ul className="grid gap-1 text-sm">
                {p.tests.slice(0, 5).map((test) => (
                  <li key={test.id} className="flex justify-between gap-2">
                    <span>
                      {test.juz
                        ? t('family.juz', { juz: test.juz })
                        : t(`family.scope.${test.scopeType}`)}{' '}
                      · {t('family.attempt', { n: test.attemptNo })}
                    </span>
                    <Badge tone={test.passed ? 'accent' : 'danger'}>
                      {test.score}/100
                    </Badge>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </Card>
      )}
    </section>
  );
}
