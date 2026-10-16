import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  CreateExcuseInput,
  MemberProgressResponse,
  ScheduleEntry,
  ScheduleResponse,
} from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { formatDate, formatTimeRange, today } from '../lib/domain';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Badge, Card, Empty, ErrorText, Field, inputClass } from './ui/form';

export function useSchedule() {
  return useQuery({
    queryKey: ['schedule'],
    queryFn: () => apiFetch<ScheduleResponse>('/api/v1/schedule'),
  });
}

export function useProgress(memberId: string | null | undefined) {
  return useQuery({
    queryKey: ['progress', memberId],
    queryFn: () => apiFetch<MemberProgressResponse>(`/api/v1/members/${memberId}/progress`),
    enabled: !!memberId,
  });
}

/** WF-08 / decision 16.1: this week, day by day, Hijri and Gregorian. */
export function WeekTimetable({ filter, title }: { filter?: (e: ScheduleEntry) => boolean; title?: string }) {
  const { t, i18n } = useTranslation();
  const schedule = useSchedule();
  const entries = (schedule.data?.entries ?? []).filter(filter ?? (() => true));
  const days = [...new Set(entries.map((e) => e.date))];

  return (
    <Card title={title ?? t('family.week')}>
      {schedule.isError ? <ErrorText error={schedule.error} /> : null}
      {schedule.data && entries.length === 0 ? <Empty>{t('family.noClasses')}</Empty> : null}
      <ol className="grid gap-3">
        {days.map((day) => (
          <li key={day} className="grid gap-1">
            <h3 className="text-xs font-semibold text-muted">{formatDate(day, i18n.language)}</h3>
            <ul className="grid gap-1">
              {entries
                .filter((e) => e.date === day)
                .map((e) => (
                  <li
                    key={`${e.sessionId}:${e.memberId}:${e.role}`}
                    className={cn(
                      'flex flex-wrap items-center justify-between gap-2 rounded-lg bg-paper px-3 py-2 text-sm',
                      e.status === 'CANCELLED' && 'text-muted line-through',
                    )}
                  >
                    <span className="font-medium">{e.courseName}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs">
                        {formatTimeRange(e.startsAt, e.endsAt, i18n.language, schedule.data?.timezone)}
                      </span>
                      <Badge tone={e.role === 'TEACHING' ? 'accent' : 'neutral'}>
                        {e.role === 'WARD' ? e.memberName : t(`family.role.${e.role}`)}
                      </Badge>
                      {e.status === 'CANCELLED' ? <Badge tone="danger">{t('family.cancelled')}</Badge> : null}
                    </span>
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ol>
    </Card>
  );
}

const pct = (rate: number | null) => (rate === null ? '—' : `${Math.round(rate * 100)}%`);

/** The member card's numbers: attendance, memorization, tests, homework, excuses (PERM-07). */
const STATUSES = ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'] as const;
type Status = (typeof STATUSES)[number];
const DOT: Record<Status, string> = { PRESENT: 'bg-accent', LATE: 'bg-gold', ABSENT: 'bg-danger', EXCUSED: 'bg-muted' };
const PILL: Record<Status, string> = {
  PRESENT: 'bg-accent-soft text-accent-strong',
  LATE: 'bg-gold/20 text-ink',
  ABSENT: 'bg-danger-soft text-danger',
  EXCUSED: 'border border-line text-muted',
};
/** "Thursday 15 October": enough to place a class, without the Hijri date on every row. */
const shortDate = (date: string, locale: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

export function ProgressPanel({ memberId }: { memberId: string }) {
  const { t, i18n } = useTranslation();
  const progress = useProgress(memberId);
  if (progress.isError) return <ErrorText error={progress.error} />;
  const p = progress.data;
  if (!p) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title={t('family.attendance')}>
        {p.courses.length === 0 ? <Empty>{t('family.noCourses')}</Empty> : null}
        <ul className="grid gap-3 text-sm">
          {p.courses.map((c) => {
            const total = STATUSES.reduce((sum, s) => sum + c.attendance[s], 0);
            const shown = STATUSES.filter((s) => c.attendance[s] > 0);
            return (
              <li key={c.courseId} className="grid gap-2.5 rounded-xl bg-paper p-3">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{c.courseName}</span>
                  <span className="text-2xl font-semibold text-accent">{pct(c.attendance.rate)}</span>
                </span>
                {total ? (
                  <span className="flex h-2 overflow-hidden rounded-full bg-line" aria-hidden="true">
                    {shown.map((s) => (
                      <span key={s} className={DOT[s]} style={{ width: `${(c.attendance[s] / total) * 100}%` }} />
                    ))}
                  </span>
                ) : null}
                <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  {shown.map((s) => (
                    <span key={s} className="flex items-center gap-1.5">
                      <span className={cn('size-2 rounded-full', DOT[s])} />
                      {t(`classMode.status.${s}`)} {c.attendance[s]}
                    </span>
                  ))}
                </span>
              </li>
            );
          })}
        </ul>
        {p.recentAttendance.length ? (
          <>
            <h3 className="mt-4 mb-1 text-sm font-semibold">{t('family.recent')}</h3>
            <ul className="text-sm">
              {p.recentAttendance.slice(0, 6).map((a, i) => (
                <li key={i} className="flex items-center justify-between gap-2 border-b border-line py-2 last:border-0">
                  <span>
                    {shortDate(a.date, i18n.language)}
                    {p.courses.length > 1 ? <span className="text-muted"> · {a.courseName}</span> : null}
                  </span>
                  <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', PILL[a.status])}>
                    {t(`classMode.status.${a.status}`)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </Card>

      <Card title={t('family.memorization')}>
        {p.summaries.length === 0 ? <Empty>{t('classMode.noPosition')}</Empty> : null}
        <ul className="grid gap-2 text-sm">
          {p.summaries.map((s) => (
            <li key={s.materialId} className="grid gap-1 rounded-lg bg-paper px-3 py-2">
              <span className="font-medium">{s.materialTitle}</span>
              <span className="text-xs text-muted">
                {t('family.pages', { count: s.pagesMemorized })}
                {s.ayahsMemorized ? ` · ${t('family.ayahs', { count: s.ayahsMemorized })}` : ''}
                {s.lastPageReached ? ` · ${t('classMode.lastPage', { page: s.lastPageReached })}` : ''}
              </span>
            </li>
          ))}
        </ul>
        {p.tests.length ? (
          <>
            <h3 className="mt-4 mb-2 text-sm font-semibold">{t('family.tests')}</h3>
            <ul className="grid gap-1 text-sm">
              {p.tests.slice(0, 5).map((test) => (
                <li key={test.id} className="flex justify-between gap-2">
                  <span>
                    {test.juz ? t('family.juz', { juz: test.juz }) : t(`family.scope.${test.scopeType}`)} ·{' '}
                    {t('family.attempt', { n: test.attemptNo })}
                  </span>
                  <Badge tone={test.passed ? 'accent' : 'danger'}>{test.score}/100</Badge>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </Card>

      <Card title={t('family.homework')}>
        {p.homework.length === 0 ? <Empty>{t('family.noHomework')}</Empty> : null}
        <ul className="grid gap-2 text-sm">
          {p.homework.map((h) => (
            <li key={h.taskId} className="flex items-start justify-between gap-2 rounded-lg bg-paper px-3 py-2">
              <span className="grid">
                <span className="font-medium">{h.title}</span>
                <span className="text-xs text-muted">
                  {h.courseName} · {t('family.due', { date: formatDate(h.dueDate, i18n.language) })}
                </span>
              </span>
              <Badge tone={h.status === 'DONE' ? 'accent' : h.status === 'MISSED' ? 'danger' : 'neutral'}>
                {t(`homework.status.${h.status}`)}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>

      <Card title={t('excuses.title')}>
        <ExcuseForm memberId={memberId} />
        {p.excuses.length ? (
          <ul className="mt-3 grid gap-1 text-sm">
            {p.excuses.map((x) => (
              <li key={x.id} className="flex justify-between gap-2">
                <span>
                  {formatDate(x.fromDate, i18n.language)}
                  {x.toDate !== x.fromDate ? ` – ${formatDate(x.toDate, i18n.language)}` : ''} · {x.reason}
                </span>
                <Badge tone={x.status === 'ACCEPTED' ? 'accent' : x.status === 'REJECTED' ? 'danger' : 'neutral'}>
                  {t(`excuses.status.${x.status}`)}
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </div>
  );
}

/** WF-08: submit an excuse for a date range before or after an absence. */
export function ExcuseForm({ memberId }: { memberId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ fromDate: today(), toDate: today(), reason: '' });
  const submit = useMutation({
    mutationFn: (body: CreateExcuseInput) =>
      apiFetch('/api/v1/excuses', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      setForm({ ...form, reason: '' });
      void queryClient.invalidateQueries({ queryKey: ['progress', memberId] });
    },
  });
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit.mutate({ memberId, courseId: null, ...form });
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <Field label={t('excuses.from')}>
          <input type="date" className={`${inputClass} min-w-0`} value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} />
        </Field>
        <Field label={t('excuses.to')}>
          <input type="date" className={`${inputClass} min-w-0`} value={form.toDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} />
        </Field>
      </div>
      <Field label={t('excuses.reason')}>
        <input className={inputClass} required minLength={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
      </Field>
      {submit.isError ? <ErrorText error={submit.error} /> : null}
      {submit.isSuccess ? <p role="status" className="text-sm text-accent">{t('excuses.sent')}</p> : null}
      <Button type="submit" disabled={submit.isPending}>{t('excuses.submit')}</Button>
    </form>
  );
}
