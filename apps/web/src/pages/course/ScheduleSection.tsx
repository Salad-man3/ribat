import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  OrgPrayerTimesResponse,
  PauseResponse,
  Prayer,
  PrayerTimes,
  ScheduleRule,
  ScheduleRuleResponse,
  SessionResponse,
  TimePoint,
} from '@ribat/shared';
import { apiFetch } from '../../api/api-fetch';
import { courseKey } from '../../api/courses';
import { Button } from '../../components/ui/button';
import {
  Card,
  Empty,
  ErrorText,
  Field,
  inputClass,
} from '../../components/ui/form';
import {
  formatDate,
  formatTime,
  fromMinutes,
  toMinutes,
  WEEKDAYS,
} from '../../lib/domain';
import type { SectionProps } from './types';

const PRAYER_ANCHORS: Prayer[] = [
  'FAJR',
  'SUNRISE',
  'DHUHR',
  'ASR',
  'MAGHRIB',
  'ISHA',
];

/** Today's clock time for a point, using the mosque's prayer times. */
function resolve(point: TimePoint, times?: PrayerTimes): string | null {
  if (point.anchor === 'FIXED') return point.time;
  if (!times) return null;
  return fromMinutes(
    toMinutes(times[point.prayer.toLowerCase() as keyof PrayerTimes]) +
      point.offsetMin,
  );
}

function useOrgTimes() {
  return useQuery({
    queryKey: ['organization', 'prayer-times'],
    queryFn: () =>
      apiFetch<OrgPrayerTimesResponse>('/api/v1/organization/prayer-times'),
  });
}

export function ScheduleSection({ course, staff, writable }: SectionProps) {
  const { t, i18n } = useTranslation();
  const orgTimes = useOrgTimes();
  const sessions = useQuery({
    queryKey: courseKey(course.id, 'sessions'),
    queryFn: () =>
      apiFetch<SessionResponse[]>(`/api/v1/courses/${course.id}/sessions`),
  });
  const timeZone = orgTimes.data?.timezone;

  return (
    <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
      <div className="grid gap-6">
        <RulesCard
          course={course}
          canEdit={staff && writable}
          times={orgTimes.data?.times}
        />
        <PausesCard course={course} canEdit={staff && writable} />
      </div>
      <Card
        title={t('sessions.title')}
        actions={
          <Button
            variant="ghost"
            className="min-h-8 px-2 text-xs"
            onClick={() => void sessions.refetch()}
          >
            {t('sessions.refresh')}
          </Button>
        }
      >
        {course.status !== 'ACTIVE' ? (
          <p className="mb-3 text-xs text-muted">{t('sessions.onlyActive')}</p>
        ) : null}
        {sessions.data?.length === 0 ? (
          <Empty>{t('sessions.empty')}</Empty>
        ) : null}
        <ul className="grid max-h-[28rem] gap-1 overflow-y-auto text-sm">
          {(sessions.data ?? []).map((s) => (
            <li
              key={s.id}
              className="flex justify-between gap-2 rounded-lg px-2 py-1.5 odd:bg-paper"
            >
              <span>{formatDate(s.date, i18n.language)}</span>
              <span dir="ltr" className="tabular-nums text-muted">
                {formatTime(s.startsAt, i18n.language, timeZone)} –{' '}
                {formatTime(s.endsAt, i18n.language, timeZone)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function PointEditor({
  value,
  onChange,
  times,
}: {
  value: TimePoint;
  onChange: (p: TimePoint) => void;
  times?: PrayerTimes;
}) {
  const { t } = useTranslation();
  const preview = resolve(value, times);
  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap gap-1">
        <select
          aria-label={t('schedule.anchor')}
          className={`${inputClass} w-auto`}
          value={value.anchor === 'FIXED' ? 'FIXED' : value.prayer}
          onChange={(e) =>
            onChange(
              e.target.value === 'FIXED'
                ? { anchor: 'FIXED', time: preview ?? '16:00' }
                : {
                    anchor: 'PRAYER',
                    prayer: e.target.value as Prayer,
                    offsetMin: value.anchor === 'PRAYER' ? value.offsetMin : 0,
                  },
            )
          }
        >
          <option value="FIXED">{t('schedule.fixed')}</option>
          {PRAYER_ANCHORS.map((p) => (
            <option key={p} value={p}>
              {t(`organization.prayers.${p.toLowerCase()}`)}
            </option>
          ))}
        </select>
        {value.anchor === 'FIXED' ? (
          <input
            type="time"
            dir="ltr"
            aria-label={t('schedule.time')}
            className={`${inputClass} w-auto`}
            value={value.time}
            onChange={(e) =>
              e.target.value && onChange({ ...value, time: e.target.value })
            }
          />
        ) : (
          <input
            type="number"
            dir="ltr"
            step={5}
            aria-label={t('schedule.offset')}
            title={t('schedule.offset')}
            className={`${inputClass} w-20`}
            value={value.offsetMin}
            onChange={(e) =>
              onChange({ ...value, offsetMin: Number(e.target.value) })
            }
          />
        )}
      </div>
      {value.anchor === 'PRAYER' && preview ? (
        <span className="text-xs text-muted">
          {t('schedule.todayAt')} <span dir="ltr">{preview}</span>
        </span>
      ) : null}
    </div>
  );
}

function describe(point: TimePoint, t: (k: string) => string) {
  if (point.anchor === 'FIXED') return point.time;
  const offset = point.offsetMin
    ? ` ${point.offsetMin > 0 ? '+' : ''}${point.offsetMin}′`
    : '';
  return `${t(`organization.prayers.${point.prayer.toLowerCase()}`)}${offset}`;
}

function RulesCard({
  course,
  canEdit,
  times,
}: {
  course: SectionProps['course'];
  canEdit: boolean;
  times?: PrayerTimes;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const key = courseKey(course.id, 'schedule');
  const saved = useQuery({
    queryKey: key,
    queryFn: () =>
      apiFetch<ScheduleRuleResponse[]>(`/api/v1/courses/${course.id}/schedule`),
  });
  const [rules, setRules] = useState<ScheduleRule[] | null>(null);
  useEffect(() => {
    if (saved.data && rules === null) {
      setRules(
        saved.data.map(({ weekday, start, end }) => ({ weekday, start, end })),
      );
    }
  }, [saved.data, rules]);

  const save = useMutation({
    mutationFn: () =>
      apiFetch<ScheduleRuleResponse[]>(
        `/api/v1/courses/${course.id}/schedule`,
        {
          method: 'PUT',
          body: JSON.stringify({ rules }),
        },
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(key, data);
      // Sessions are generated by the background worker; look again shortly.
      setTimeout(
        () =>
          void queryClient.invalidateQueries({
            queryKey: courseKey(course.id, 'sessions'),
          }),
        1500,
      );
    },
  });
  const update = (index: number, rule: ScheduleRule) =>
    setRules((current) => current!.map((r, i) => (i === index ? rule : r)));
  const dirty =
    JSON.stringify(rules) !==
    JSON.stringify(
      saved.data?.map(({ weekday, start, end }) => ({ weekday, start, end })),
    );

  return (
    <Card title={t('schedule.title')}>
      <p className="mb-3 text-xs text-muted">{t('schedule.hint')}</p>
      {!canEdit ? (
        <ul className="grid gap-1 text-sm">
          {(saved.data ?? []).map((rule) => (
            <li
              key={rule.id}
              className="flex justify-between gap-2 rounded-lg bg-paper px-3 py-2"
            >
              <span className="font-medium">
                {t(`schedule.weekdays.${rule.weekday}`)}
              </span>
              <span>
                {describe(rule.start, t)} → {describe(rule.end, t)}
              </span>
            </li>
          ))}
          {saved.data?.length === 0 ? (
            <Empty>{t('schedule.empty')}</Empty>
          ) : null}
        </ul>
      ) : (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          {(rules ?? []).map((rule, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-start"
            >
              <select
                aria-label={t('schedule.weekday')}
                className={`${inputClass} w-auto`}
                value={rule.weekday}
                onChange={(e) =>
                  update(index, { ...rule, weekday: Number(e.target.value) })
                }
              >
                {WEEKDAYS.map((d) => (
                  <option key={d} value={d}>
                    {t(`schedule.weekdays.${d}`)}
                  </option>
                ))}
              </select>
              <Field label={t('schedule.from')} className="text-xs">
                <PointEditor
                  value={rule.start}
                  times={times}
                  onChange={(start) => update(index, { ...rule, start })}
                />
              </Field>
              <Field label={t('schedule.to')} className="text-xs">
                <PointEditor
                  value={rule.end}
                  times={times}
                  onChange={(end) => update(index, { ...rule, end })}
                />
              </Field>
              <button
                type="button"
                className="justify-self-start text-xs text-danger underline sm:mt-6"
                onClick={() =>
                  setRules((current) => current!.filter((_, i) => i !== index))
                }
              >
                {t('common.remove')}
              </button>
            </div>
          ))}
          {rules?.length === 0 ? <Empty>{t('schedule.empty')}</Empty> : null}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={() =>
                setRules((current) => [
                  ...(current ?? []),
                  {
                    weekday: current?.length
                      ? (current[current.length - 1].weekday + 1) % 7
                      : 0,
                    start: { anchor: 'PRAYER', prayer: 'ASR', offsetMin: 0 },
                    end: { anchor: 'PRAYER', prayer: 'MAGHRIB', offsetMin: 0 },
                  },
                ])
              }
            >
              + {t('schedule.addDay')}
            </Button>
            <Button type="submit" disabled={save.isPending || !dirty}>
              {t('schedule.save')}
            </Button>
            {save.isSuccess && !dirty ? (
              <span className="self-center text-sm text-accent">
                {t('common.saved')}
              </span>
            ) : null}
          </div>
          {save.isError ? <ErrorText error={save.error} /> : null}
        </form>
      )}
    </Card>
  );
}

function PausesCard({
  course,
  canEdit,
}: {
  course: SectionProps['course'];
  canEdit: boolean;
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const key = courseKey(course.id, 'pauses');
  const pauses = useQuery({
    queryKey: key,
    queryFn: () =>
      apiFetch<PauseResponse[]>(`/api/v1/courses/${course.id}/pauses`),
  });
  const [form, setForm] = useState({ fromDate: '', toDate: '', reason: '' });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: key });
    setTimeout(
      () =>
        void queryClient.invalidateQueries({
          queryKey: courseKey(course.id, 'sessions'),
        }),
      1500,
    );
  };
  const add = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/courses/${course.id}/pauses`, {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          reason: form.reason.trim() || undefined,
        }),
      }),
    onSuccess: async () => {
      setForm({ fromDate: '', toDate: '', reason: '' });
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/courses/${course.id}/pauses/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: refresh,
  });

  return (
    <Card title={t('pauses.title')}>
      <p className="mb-3 text-xs text-muted">{t('pauses.hint')}</p>
      <ul className="grid gap-1 text-sm">
        {(pauses.data ?? []).map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap justify-between gap-2 rounded-lg bg-paper px-3 py-2"
          >
            <span>
              {formatDate(p.fromDate, i18n.language)} –{' '}
              {formatDate(p.toDate, i18n.language)}
              {p.reason ? (
                <span className="ms-2 text-muted">· {p.reason}</span>
              ) : null}
            </span>
            {canEdit ? (
              <button
                type="button"
                className="text-xs text-danger underline"
                onClick={() => remove.mutate(p.id)}
              >
                {t('common.remove')}
              </button>
            ) : null}
          </li>
        ))}
        {pauses.data?.length === 0 ? (
          <li className="text-xs text-muted">{t('pauses.empty')}</li>
        ) : null}
      </ul>
      {canEdit ? (
        <form
          className="mt-3 grid gap-2 sm:grid-cols-[auto_auto_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <input
            type="date"
            aria-label={t('pauses.from')}
            className={inputClass}
            value={form.fromDate}
            onChange={(e) => setForm({ ...form, fromDate: e.target.value })}
            required
          />
          <input
            type="date"
            aria-label={t('pauses.to')}
            className={inputClass}
            value={form.toDate}
            min={form.fromDate}
            onChange={(e) => setForm({ ...form, toDate: e.target.value })}
            required
          />
          <input
            className={inputClass}
            placeholder={t('pauses.reason')}
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
          />
          <Button type="submit" variant="ghost" disabled={add.isPending}>
            {t('pauses.add')}
          </Button>
        </form>
      ) : null}
      {add.isError ? <ErrorText error={add.error} /> : null}
    </Card>
  );
}
