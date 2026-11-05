import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { StaffSessionsResponse } from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { Card, PageHeader, Field, inputClass } from '../components/ui/form';
import {
  addDays,
  formatTimeRange,
  weekBoundsSaturdayFirst,
  today,
} from '../lib/domain';
import { overlapColumns } from '../lib/calendar-overlap';

export function StaffCalendarPage() {
  const { t, i18n } = useTranslation();
  const bounds = weekBoundsSaturdayFirst(today());
  const [from, setFrom] = useState(bounds.from);
  const to = addDays(from, 6);
  const [courseFilter, setCourseFilter] = useState('');
  const courses = useQuery({
    queryKey: ['courses', 'CURRENT'],
    queryFn: () => apiFetch<{ id: string; name: string }[]>('/api/v1/courses'),
  });
  const sessions = useQuery({
    queryKey: ['staff-sessions', from, to],
    queryFn: () =>
      apiFetch<StaffSessionsResponse>(`/api/v1/sessions?from=${from}&to=${to}`),
  });

  const rows = useMemo(() => {
    const list = sessions.data?.sessions ?? [];
    return courseFilter
      ? list.filter((s) => s.courseId === courseFilter)
      : list;
  }, [sessions.data, courseFilter]);

  const byDay = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const s of rows) {
      const list = map.get(s.date) ?? [];
      list.push(s);
      map.set(s.date, list);
    }
    return map;
  }, [rows]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(from, i)),
    [from],
  );

  return (
    <section className="grid gap-6">
      <PageHeader
        chrome
        title={t('staffCalendar.title')}
        subtitle={t('staffCalendar.subtitle')}
      />
      <div className="flex flex-wrap gap-3">
        <Field label={t('staff.weekThis')} className="text-sm">
          <input
            type="date"
            className={inputClass}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field
          label={t('staffCalendar.filterHalaqa')}
          className="min-w-[12rem] text-sm"
        >
          <select
            className={inputClass}
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
          >
            <option value="">{t('staffCalendar.allSessions')}</option>
            {courses.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid gap-3 md:grid-cols-7">
        {days.map((date) => {
          const daySessions = byDay.get(date) ?? [];
          const cols = overlapColumns(
            daySessions.map((s) => ({
              id: s.id,
              startsAt: s.startsAt,
              endsAt: s.endsAt,
            })),
          );
          return (
            <Card key={date} title={date}>
              <ul className="grid gap-1 text-xs">
                {daySessions.map((s) => (
                  <li
                    key={s.id}
                    style={{
                      marginInlineStart: `${(cols.get(s.id) ?? 0) * 8}px`,
                    }}
                  >
                    <Link
                      to={`/staff/courses/${s.courseId}`}
                      className="block rounded border border-line bg-surface p-1 hover:border-accent"
                    >
                      <span className="font-semibold">{s.courseName}</span>
                      <span className="block text-muted">
                        {formatTimeRange(s.startsAt, s.endsAt, i18n.language)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
