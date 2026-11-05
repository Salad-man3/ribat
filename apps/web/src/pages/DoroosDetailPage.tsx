import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import type { SessionAttendanceResponse } from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { useCourse } from '../api/courses';
import { BackLink, Card, Empty, PageHeader } from '../components/ui/form';
import { NavButton } from '../components/ui/nav-button';
import { useFormatDates } from '../lib/calendar';
import { addDays, formatTimeRange, today } from '../lib/domain';

export function DoroosDetailPage() {
  const { id = '' } = useParams();
  const { t, i18n } = useTranslation();
  const { formatDate } = useFormatDates();
  const course = useCourse(id);
  const rangeFrom = '2020-01-01';
  const rangeTo = addDays(today(), 365);
  const sessions = useQuery({
    queryKey: ['course-sessions', id, 'all'],
    queryFn: () =>
      apiFetch<
        {
          id: string;
          date: string;
          startsAt: string;
          endsAt: string;
          status: string;
        }[]
      >(`/api/v1/courses/${id}/sessions?from=${rangeFrom}&to=${rangeTo}`),
    enabled: Boolean(id),
  });
  const session = sessions.data?.[0];
  const day = today();
  const roster = useQuery({
    queryKey: ['session-attendance', session?.id],
    queryFn: () =>
      apiFetch<SessionAttendanceResponse>(
        `/api/v1/sessions/${session!.id}/attendance`,
      ),
    enabled: Boolean(session?.id),
  });

  if (!course.data) return <p className="text-sm text-muted">…</p>;
  const done =
    session &&
    (session.status === 'HELD' ||
      new Date(session.endsAt).getTime() < Date.now() ||
      (roster.data?.roster.some((r) => r.attendance) ?? false));

  return (
    <section className="grid gap-6">
      <BackLink to="/staff/doroos">{t('doroos.title')}</BackLink>
      <PageHeader title={course.data.name} subtitle={t('doroos.oneOff')} />
      {session ? (
        <p className="text-sm text-muted">
          {formatDate(session.date)} ·{' '}
          {formatTimeRange(session.startsAt, session.endsAt, i18n.language)}
        </p>
      ) : null}
      {session && session.date === day && session.status !== 'CANCELLED' ? (
        <NavButton
          to={`/teach/${session.id}`}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
        >
          {t('staff.openClass')}
        </NavButton>
      ) : null}
      <Card title={done ? t('doroos.attended') : t('doroos.assigned')}>
        {!roster.data?.roster.length ? (
          <Empty>{t('doroos.noStudents')}</Empty>
        ) : null}
        <ul className="grid gap-1 text-sm">
          {roster.data?.roster.map((r) => (
            <li
              key={r.enrollmentId}
              className="flex justify-between rounded-lg bg-paper px-3 py-2"
            >
              <span>{r.name}</span>
              <span className="text-muted">
                {r.attendance
                  ? t(`classMode.status.${r.attendance.status}`)
                  : t('classMode.status.none')}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
