import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  CourseType,
  ProgramResponse,
  ScheduleRule,
  TimePoint,
} from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { MemberCombobox } from './MemberCombobox';
import {
  TimePointEditor,
  useOrgPrayerTimes,
} from './TimePointEditor';
import { Button } from './ui/button';
import { Field, inputClass } from './ui/form';
import { cn } from '../lib/utils';
import { WEEKDAYS } from '../lib/domain';

const TYPES: CourseType[] = ['MEMORIZATION', 'EXPLANATION', 'BOTH'];

const DEFAULT_DAY_RULE: Pick<ScheduleRule, 'start' | 'end'> = {
  start: { anchor: 'PRAYER', prayer: 'ASR', offsetMin: 0 },
  end: { anchor: 'PRAYER', prayer: 'MAGHRIB', offsetMin: 0 },
};

export type CourseFormValues = {
  name: string;
  type: CourseType;
  programId: string;
  teacherMemberId: string;
  rules: ScheduleRule[];
};

export function CourseForm({
  initial,
  submitLabel,
  pending,
  onSubmit,
}: {
  initial?: Partial<CourseFormValues>;
  submitLabel: string;
  pending?: boolean;
  onSubmit: (values: CourseFormValues) => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<CourseType>(initial?.type ?? 'MEMORIZATION');
  const [programId, setProgramId] = useState(initial?.programId ?? '');
  const [teacherMemberId, setTeacherMemberId] = useState(
    initial?.teacherMemberId ?? '',
  );
  const [rules, setRules] = useState<ScheduleRule[]>(() => [
    ...(initial?.rules ?? []),
  ]);

  const orgTimes = useOrgPrayerTimes();
  const prayerTimes = orgTimes.data?.times;

  const programs = useQuery({
    queryKey: ['programs'],
    queryFn: () => apiFetch<ProgramResponse[]>('/api/v1/programs'),
  });

  const selectedDays = useMemo(
    () => new Set(rules.map((r) => r.weekday)),
    [rules],
  );

  const toggleDay = (d: number) => {
    setRules((prev) => {
      if (prev.some((r) => r.weekday === d)) {
        return prev.filter((r) => r.weekday !== d);
      }
      return [...prev, { weekday: d, ...DEFAULT_DAY_RULE }].sort(
        (a, b) => a.weekday - b.weekday,
      );
    });
  };

  const updateRule = (
    weekday: number,
    patch: { start?: TimePoint; end?: TimePoint },
  ) => {
    setRules((prev) =>
      prev.map((r) => (r.weekday === weekday ? { ...r, ...patch } : r)),
    );
  };

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit({
          name,
          type,
          programId,
          teacherMemberId,
          rules: [...rules].sort((a, b) => a.weekday - b.weekday),
        });
      }}
    >
      <Field label={t('courses.name')}>
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </Field>

      <Field label={t('courses.typeLabel')}>
        <div className="grid gap-2 sm:grid-cols-3">
          {TYPES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setType(value)}
              className={cn(
                'rounded-xl border px-3 py-3 text-start text-sm transition',
                type === value
                  ? 'border-accent bg-accent text-accent-ink'
                  : 'border-line bg-surface hover:border-accent/50',
              )}
            >
              <span className="block font-semibold">
                {t(`courses.typeCard.${value}.title`)}
              </span>
              <span
                className={cn(
                  'mt-1 block text-xs',
                  type === value ? 'text-accent-ink/90' : 'text-muted',
                )}
              >
                {t(`courses.typeCard.${value}.hint`)}
              </span>
            </button>
          ))}
        </div>
      </Field>

      <Field label={t('courses.program')}>
        <select
          className={inputClass}
          value={programId}
          onChange={(e) => setProgramId(e.target.value)}
        >
          <option value="">{t('courses.programNone')}</option>
          {(programs.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-1.5 text-sm font-medium text-ink">
        <span>{t('courses.leadTeacher')}</span>
        <MemberCombobox
          value={teacherMemberId}
          onChange={setTeacherMemberId}
          includeCourses
          placeholder={t('courses.teacherOptional')}
        />
      </div>

      <Field label={t('schedule.daysLabel')}>
        <div className="flex flex-wrap gap-1">
          {WEEKDAYS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDay(d)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm',
                selectedDays.has(d)
                  ? 'bg-accent text-accent-ink'
                  : 'border border-line text-muted',
              )}
            >
              {t(`schedule.weekdays.${d}`)}
            </button>
          ))}
        </div>
      </Field>

      {[...rules]
        .sort((a, b) => a.weekday - b.weekday)
        .map((rule) => (
          <div
            key={rule.weekday}
            className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-2"
          >
            <p className="text-sm font-medium sm:col-span-2">
              {t(`schedule.weekdays.${rule.weekday}`)}
            </p>
            <Field label={t('schedule.from')} className="text-xs">
              <TimePointEditor
                value={rule.start}
                times={prayerTimes}
                onChange={(start) => updateRule(rule.weekday, { start })}
              />
            </Field>
            <Field label={t('schedule.to')} className="text-xs">
              <TimePointEditor
                value={rule.end}
                times={prayerTimes}
                onChange={(end) => updateRule(rule.weekday, { end })}
              />
            </Field>
          </div>
        ))}

      <Button type="submit" disabled={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}
