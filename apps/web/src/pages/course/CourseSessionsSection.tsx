import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SessionResponse } from '@ribat/shared';
import { apiFetch } from '../../api/api-fetch';
import { courseKey } from '../../api/courses';
import { useOrgPrayerTimes } from '../../components/TimePointEditor';
import { Card, Empty, Field, inputClass } from '../../components/ui/form';
import { NavButton } from '../../components/ui/nav-button';
import { useFormatDates } from '../../lib/calendar';
import { addDays, formatTimeRange, today } from '../../lib/domain';
import type { SectionProps } from './types';

function sessionLabel(s: SessionResponse, t: (key: string) => string): string {
  if (s.status === 'CANCELLED') return t('sessions.statusCancelled');
  if (s.status === 'HELD') return t('sessions.statusHeld');
  if ((s.attendanceCount ?? 0) > 0) return t('sessions.statusMarked');
  return t('sessions.statusScheduled');
}

export function CourseSessionsSection({ course, staff }: SectionProps) {
  const courseBase = staff
    ? `/staff/courses/${course.id}`
    : `/member/courses/${course.id}`;
  const { t, i18n } = useTranslation();
  const { formatDate } = useFormatDates();
  const orgTimes = useOrgPrayerTimes();
  const dayToday = today();
  const [from, setFrom] = useState(addDays(dayToday, -30));
  const [to, setTo] = useState(dayToday);

  const sessions = useQuery({
    queryKey: courseKey(course.id, 'sessions', from, to),
    queryFn: () =>
      apiFetch<SessionResponse[]>(
        `/api/v1/courses/${course.id}/sessions?from=${from}&to=${to}`,
      ),
  });

  const timeZone = orgTimes.data?.timezone;
  const rows = [...(sessions.data ?? [])].sort((a, b) =>
    b.startsAt.localeCompare(a.startsAt),
  );

  return (
    <Card title={t('courses.tabSessions')}>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Field label={t('sessions.from')}>
          <input
            type="date"
            className={inputClass}
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label={t('sessions.to')}>
          <input
            type="date"
            className={inputClass}
            value={to}
            min={from}
            max={dayToday}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
      </div>
      {sessions.isLoading ? <p className="text-sm text-muted">…</p> : null}
      {rows.length === 0 ? <Empty>{t('sessions.empty')}</Empty> : null}
      <ul className="grid max-h-[32rem] gap-1 overflow-y-auto text-sm">
        {rows.map((s) => {
          const history = s.date < dayToday;
          return (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-2 odd:bg-paper"
            >
              <div className="grid gap-0.5">
                <span className="font-medium">{formatDate(s.date)}</span>
                <span className="text-xs text-muted">
                  {formatTimeRange(
                    s.startsAt,
                    s.endsAt,
                    i18n.language,
                    timeZone,
                  )}{' '}
                  · {sessionLabel(s, t)}
                  {s.rosterCount != null
                    ? ` · ${t('sessions.attendanceFraction', {
                        marked: s.attendanceCount ?? 0,
                        total: s.rosterCount,
                      })}`
                    : null}
                </span>
              </div>
              {s.status !== 'CANCELLED' ? (
                <NavButton
                  to={`/teach/${s.id}`}
                  state={{ coursePath: `${courseBase}?tab=sessions`, history }}
                  className="text-xs font-semibold text-accent"
                >
                  {history ? t('sessions.viewHistory') : t('staff.openClass')}
                </NavButton>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
