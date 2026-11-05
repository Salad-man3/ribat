import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  CreateExcuseInput,
  MemberProgressResponse,
  ScheduleEntry,
  ScheduleResponse,
} from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { useFormatDates } from '../lib/calendar';
import {
  formatMonthDay,
  formatTimeRange,
  saturdayWeekBounds,
  today,
  weekdayUtc,
} from '../lib/domain';
import { useFillWidthPct } from '../lib/fill-width';
import { cn } from '../lib/utils';
import { MemberNameLink } from './MemberNameLink';
import { Button } from './ui/button';
import { NavButton } from './ui/nav-button';
import { Badge, Card, Empty, ErrorText, Field, inputClass } from './ui/form';
import { HifzMap } from './HifzMap';

export function useSchedule(from?: string, to?: string) {
  const scoped = from != null && to != null;
  return useQuery({
    queryKey: scoped ? ['schedule', from, to] : ['schedule'],
    queryFn: () => {
      const qs = scoped
        ? `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
        : '';
      return apiFetch<ScheduleResponse>(`/api/v1/schedule${qs}`);
    },
  });
}

/** Member/guardian lobby: one Saturday-first week fetch shared by today + week board. */
export function useLobbyWeekSchedule() {
  const bounds = saturdayWeekBounds();
  const schedule = useSchedule(bounds.from, bounds.to);
  return { bounds, schedule };
}

export function useProgress(memberId: string | null | undefined) {
  return useQuery({
    queryKey: ['progress', memberId],
    queryFn: () =>
      apiFetch<MemberProgressResponse>(`/api/v1/members/${memberId}/progress`),
    enabled: !!memberId,
  });
}

function scheduleSessionHref(e: ScheduleEntry): string | null {
  if (e.status === 'CANCELLED') return null;
  if (e.role === 'TEACHING') return `/member/courses/${e.courseId}`;
  if (e.role === 'STUDYING') return `/member/sessions/${e.sessionId}`;
  return null;
}

function TodayHalaqaLink({
  entry,
  timezone,
  tone,
}: {
  entry: ScheduleEntry;
  timezone: string | undefined;
  tone: 'teach' | 'study';
}) {
  const { t, i18n } = useTranslation();
  const href = scheduleSessionHref(entry);
  const body = (
    <>
      <span className="font-semibold">{entry.courseName}</span>
      <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
        {formatTimeRange(entry.startsAt, entry.endsAt, i18n.language, timezone)}
        <Badge tone={tone === 'teach' ? 'accent' : 'neutral'}>
          {t(`family.role.${entry.role}`)}
        </Badge>
      </span>
    </>
  );
  const className = cn(
    'flex w-full flex-col gap-1 rounded-xl border p-3 text-start text-sm transition',
    tone === 'teach'
      ? 'border-accent/30 bg-accent-soft/40 hover:border-accent'
      : 'border-line bg-paper hover:border-accent/50',
  );
  if (!href) return <div className={className}>{body}</div>;
  return (
    <NavButton to={href} className={className}>
      {body}
    </NavButton>
  );
}

function TodayHalaqaGroup({
  title,
  rows,
  timezone,
  tone,
  empty,
}: {
  title: string;
  rows: ScheduleEntry[];
  timezone: string | undefined;
  tone: 'teach' | 'study';
  empty: string;
}) {
  return (
    <div className="grid gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="grid gap-2">
          {rows.map((e) => (
            <li key={`${e.sessionId}:${e.role}`}>
              <TodayHalaqaLink entry={e} timezone={timezone} tone={tone} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Member lobby: today’s circles I teach and I study (one link per session). */
export function MemberTodaySection() {
  const { t } = useTranslation();
  const { schedule } = useLobbyWeekSchedule();
  const day = today();
  const entries = schedule.data?.entries ?? [];
  const teach = entries.filter(
    (e) => e.date === day && e.role === 'TEACHING' && e.status !== 'CANCELLED',
  );
  const study = entries.filter(
    (e) => e.date === day && e.role === 'STUDYING' && e.status !== 'CANCELLED',
  );
  const tz = schedule.data?.timezone;
  return (
    <Card title={t('member.todayTitle')}>
      {schedule.isError ? <ErrorText error={schedule.error} /> : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <TodayHalaqaGroup
          title={t('member.todayTeach')}
          rows={teach}
          timezone={tz}
          tone="teach"
          empty={t('member.todayTeachEmpty')}
        />
        <TodayHalaqaGroup
          title={t('member.todayStudy')}
          rows={study}
          timezone={tz}
          tone="study"
          empty={t('member.todayStudyEmpty')}
        />
      </div>
    </Card>
  );
}

function WeekColumnHeading({ day }: { day: string }) {
  const { t, i18n } = useTranslation();
  const { calendar } = useFormatDates();
  const weekday = t(`schedule.weekdays.${weekdayUtc(day)}`);
  const md = formatMonthDay(day, i18n.language, calendar);
  return (
    <>
      {weekday}{' '}
      <span dir="ltr" className="inline-block">
        {md}
      </span>
    </>
  );
}

function WeekSessionBlock({
  entry,
  timezone,
}: {
  entry: ScheduleEntry;
  timezone: string | undefined;
}) {
  const { t, i18n } = useTranslation();
  const href = scheduleSessionHref(entry);
  const cancelled = entry.status === 'CANCELLED';
  const teach = entry.role === 'TEACHING';
  const roleLine =
    entry.role === 'WARD' ? (
      <MemberNameLink
        memberId={entry.memberId}
        className="text-[11px] text-muted"
      >
        {entry.memberName}
      </MemberNameLink>
    ) : (
      <span className="text-[11px] text-muted">
        {t(`family.role.${entry.role}`)}
      </span>
    );
  const className = cn(
    'block rounded-lg border p-2 text-start text-sm',
    cancelled && 'border-line/60 bg-paper/50 text-muted line-through',
    !cancelled &&
      teach &&
      'border-accent/35 bg-accent-soft/50 hover:border-accent',
    !cancelled && !teach && 'border-line bg-paper hover:border-accent/40',
  );
  const sessionLink =
    href && !cancelled ? (
      <NavButton
        to={href}
        className="grid gap-0.5 text-start hover:text-accent"
      >
        <span className="text-[11px] leading-tight text-muted">
          {formatTimeRange(
            entry.startsAt,
            entry.endsAt,
            i18n.language,
            timezone,
          )}
        </span>
        <span className="text-xs font-medium leading-snug">
          {entry.courseName}
        </span>
      </NavButton>
    ) : (
      <div className="grid gap-0.5">
        <span className="text-[11px] leading-tight text-muted">
          {formatTimeRange(
            entry.startsAt,
            entry.endsAt,
            i18n.language,
            timezone,
          )}
        </span>
        <span className="text-xs font-medium leading-snug">
          {entry.courseName}
        </span>
      </div>
    );
  return (
    <div className={className}>
      {sessionLink}
      {roleLine}
      {cancelled ? (
        <span className="text-[11px] text-danger">{t('family.cancelled')}</span>
      ) : null}
    </div>
  );
}

/** WF-08 / decision 16.1: week as a board (columns on wide, day chips on narrow). */
export function WeekTimetable({
  filter,
  title,
}: {
  filter?: (e: ScheduleEntry) => boolean;
  title?: string;
}) {
  const { t } = useTranslation();
  const { bounds, schedule } = useLobbyWeekSchedule();
  const entries = (schedule.data?.entries ?? []).filter(filter ?? (() => true));
  const days = bounds.days;
  const [pickedDay, setPickedDay] = useState(() => days[0] ?? today());

  useEffect(() => {
    if (days.length && !days.includes(pickedDay)) setPickedDay(days[0]!);
  }, [days, pickedDay]);

  const tz = schedule.data?.timezone;
  const blocksForDay = (day: string) =>
    entries
      .filter((e) => e.date === day)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  return (
    <Card title={title ?? t('family.week')}>
      {schedule.isError ? <ErrorText error={schedule.error} /> : null}
      {schedule.data && entries.length === 0 ? (
        <Empty>{t('family.noClasses')}</Empty>
      ) : null}
      {days.length === 0 ? null : (
        <>
          <div className="mb-3 flex gap-1 overflow-x-auto pb-1 md:hidden">
            {days.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => setPickedDay(day)}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium',
                  pickedDay === day
                    ? 'border-accent bg-accent-soft text-accent-strong'
                    : 'border-line bg-surface text-muted',
                )}
              >
                <WeekColumnHeading day={day} />
              </button>
            ))}
          </div>
          <div className="grid gap-2 md:hidden">
            {blocksForDay(pickedDay).length === 0 ? (
              <p className="text-sm text-muted">
                {t('family.noClassesThisDay')}
              </p>
            ) : (
              blocksForDay(pickedDay).map((e) => (
                <WeekSessionBlock
                  key={`${e.sessionId}:${e.memberId}:${e.role}`}
                  entry={e}
                  timezone={tz}
                />
              ))
            )}
          </div>
          <div
            className="hidden gap-2 md:grid"
            style={{
              gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
            }}
          >
            {days.map((day) => (
              <div key={day} className="grid min-w-0 gap-1.5">
                <h3 className="border-b border-line pb-1 text-xs font-semibold text-muted">
                  <WeekColumnHeading day={day} />
                </h3>
                <div className="grid gap-1.5">
                  {blocksForDay(day).length === 0 ? (
                    <p className="text-[11px] text-muted">—</p>
                  ) : (
                    blocksForDay(day).map((e) => (
                      <WeekSessionBlock
                        key={`${e.sessionId}:${e.memberId}:${e.role}`}
                        entry={e}
                        timezone={tz}
                      />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

const pct = (rate: number | null) =>
  rate === null ? '—' : `${Math.round(rate * 100)}%`;

/** The member card's numbers: attendance, memorization, tests, homework, excuses (PERM-07). */
const STATUSES = ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'] as const;
type Status = (typeof STATUSES)[number];
const DOT: Record<Status, string> = {
  PRESENT: 'bg-accent',
  LATE: 'bg-gold',
  ABSENT: 'bg-danger',
  EXCUSED: 'bg-muted',
};
const PILL: Record<Status, string> = {
  PRESENT: 'bg-accent-soft text-accent-strong',
  LATE: 'bg-gold/20 text-ink',
  ABSENT: 'bg-danger-soft text-danger',
  EXCUSED: 'border border-line text-muted',
};

function AttendanceBarSegment({
  pct,
  className,
}: {
  pct: number;
  className: string;
}) {
  const ref = useFillWidthPct<HTMLSpanElement>(pct);
  return <span ref={ref} className={cn(className, 'w-(--fill)')} />;
}

export function ProgressPanel({
  memberId,
  showExcuse = true,
}: {
  memberId: string;
  showExcuse?: boolean;
}) {
  const { t } = useTranslation();
  const { formatDate } = useFormatDates();
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
              <li
                key={c.courseId}
                className="grid gap-2.5 rounded-xl bg-paper p-3"
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{c.courseName}</span>
                  <span className="text-2xl font-semibold text-accent">
                    {pct(c.attendance.rate)}
                  </span>
                </span>
                {total ? (
                  <span
                    className="flex h-2 overflow-hidden rounded-full bg-line"
                    aria-hidden="true"
                  >
                    {shown.map((s) => (
                      <AttendanceBarSegment
                        key={s}
                        className={DOT[s]}
                        pct={(c.attendance[s] / total) * 100}
                      />
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
            <h3 className="mt-4 mb-1 text-sm font-semibold">
              {t('family.recent')}
            </h3>
            <ul className="text-sm">
              {p.recentAttendance.slice(0, 6).map((a, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-2 border-b border-line py-2 last:border-0"
                >
                  <span>
                    {formatDate(a.date)}
                    {p.courses.length > 1 ? (
                      <span className="text-muted"> · {a.courseName}</span>
                    ) : null}
                  </span>
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
          </>
        ) : null}
      </Card>

      <Card title={t('family.memorization')}>
        {p.hifz ? <HifzMap hifz={p.hifz} /> : null}
        {p.summaries.length === 0 ? (
          <Empty>{t('classMode.noPosition')}</Empty>
        ) : null}
        <ul className="grid gap-2 text-sm">
          {p.summaries.map((s) => (
            <li
              key={s.materialId}
              className="grid gap-1 rounded-lg bg-paper px-3 py-2"
            >
              <span className="font-medium">{s.materialTitle}</span>
              <span className="text-xs text-muted">
                {t('family.pages', { count: s.pagesMemorized })}
                {s.ayahsMemorized
                  ? ` · ${t('family.ayahs', { count: s.ayahsMemorized })}`
                  : ''}
                {s.lastPageReached
                  ? ` · ${t('classMode.lastPage', { page: s.lastPageReached })}`
                  : ''}
              </span>
            </li>
          ))}
        </ul>
        {p.tests.length ? (
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

      <Card title={t('family.homework')}>
        {p.homework.length === 0 ? (
          <Empty>{t('family.noHomework')}</Empty>
        ) : null}
        <ul className="grid gap-2 text-sm">
          {p.homework.map((h) => (
            <li
              key={h.taskId}
              className="flex items-start justify-between gap-2 rounded-lg bg-paper px-3 py-2"
            >
              <span className="grid">
                <span className="font-medium">{h.title}</span>
                <span className="text-xs text-muted">
                  {h.courseName} ·{' '}
                  {t('family.due', { date: formatDate(h.dueDate) })}
                </span>
              </span>
              <Badge
                tone={
                  h.status === 'DONE'
                    ? 'accent'
                    : h.status === 'MISSED'
                      ? 'danger'
                      : 'neutral'
                }
              >
                {t(`homework.status.${h.status}`)}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>

      {showExcuse ? (
        <Card title={t('excuses.title')}>
          <ExcuseForm memberId={memberId} />
          {p.excuses.length ? (
            <ul className="mt-3 grid gap-1 text-sm">
              {p.excuses.map((x) => (
                <li key={x.id} className="flex justify-between gap-2">
                  <span>
                    {formatDate(x.fromDate)}
                    {x.toDate !== x.fromDate
                      ? ` – ${formatDate(x.toDate)}`
                      : ''}{' '}
                    · {x.reason}
                  </span>
                  <Badge
                    tone={
                      x.status === 'ACCEPTED'
                        ? 'accent'
                        : x.status === 'REJECTED'
                          ? 'danger'
                          : 'neutral'
                    }
                  >
                    {t(`excuses.status.${x.status}`)}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : p.excuses.length ? (
        <Card title={t('excuses.title')}>
          <ul className="grid gap-1 text-sm">
            {p.excuses.map((x) => (
              <li key={x.id} className="flex justify-between gap-2">
                <span>
                  {formatDate(x.fromDate)}
                  {x.toDate !== x.fromDate
                    ? ` – ${formatDate(x.toDate)}`
                    : ''}{' '}
                  · {x.reason}
                </span>
                <Badge
                  tone={
                    x.status === 'ACCEPTED'
                      ? 'accent'
                      : x.status === 'REJECTED'
                        ? 'danger'
                        : 'neutral'
                  }
                >
                  {t(`excuses.status.${x.status}`)}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

/** WF-08: submit an excuse for a date range before or after an absence. */
export function ExcuseForm({ memberId }: { memberId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    fromDate: today(),
    toDate: today(),
    reason: '',
  });
  const submit = useMutation({
    mutationFn: (body: CreateExcuseInput) =>
      apiFetch('/api/v1/excuses', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
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
          <input
            type="date"
            className={`${inputClass} min-w-0`}
            value={form.fromDate}
            onChange={(e) => setForm({ ...form, fromDate: e.target.value })}
          />
        </Field>
        <Field label={t('excuses.to')}>
          <input
            type="date"
            className={`${inputClass} min-w-0`}
            value={form.toDate}
            onChange={(e) => setForm({ ...form, toDate: e.target.value })}
          />
        </Field>
      </div>
      <Field label={t('excuses.reason')}>
        <input
          className={inputClass}
          required
          minLength={3}
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
        />
      </Field>
      {submit.isError ? <ErrorText error={submit.error} /> : null}
      {submit.isSuccess ? (
        <p role="status" className="text-sm text-accent">
          {t('excuses.sent')}
        </p>
      ) : null}
      <Button type="submit" disabled={submit.isPending}>
        {t('excuses.submit')}
      </Button>
    </form>
  );
}
