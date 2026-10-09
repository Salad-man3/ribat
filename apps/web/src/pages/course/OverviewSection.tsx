import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  CourseResponse,
  CourseStatus,
  UpdateCourseInput,
} from '@ribat/shared';
import { apiFetch } from '../../api/api-fetch';
import { courseKey } from '../../api/courses';
import { Button } from '../../components/ui/button';
import { Card, ErrorText, Field, inputClass } from '../../components/ui/form';
import { COURSE_TRANSITIONS } from '../../lib/domain';
import type { SectionProps } from './types';

type Form = {
  name: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  minAge: string;
  maxAge: string;
  capacity: string;
  testPassMark: string;
};

const formFrom = (c: CourseResponse): Form => ({
  name: c.name,
  description: c.description ?? '',
  location: c.location ?? '',
  startDate: c.startDate ?? '',
  endDate: c.endDate ?? '',
  minAge: c.minAge?.toString() ?? '',
  maxAge: c.maxAge?.toString() ?? '',
  capacity: c.capacity?.toString() ?? '',
  testPassMark: c.testPassMark.toString(),
});

/** Only filled fields are sent: the API cannot clear a value in S2. */
function patchFrom(form: Form): UpdateCourseInput {
  const patch: Record<string, string | number> = { name: form.name };
  for (const key of [
    'description',
    'location',
    'startDate',
    'endDate',
  ] as const) {
    if (form[key].trim()) patch[key] = form[key].trim();
  }
  for (const key of ['minAge', 'maxAge', 'capacity', 'testPassMark'] as const) {
    if (form[key] !== '') patch[key] = Number(form[key]);
  }
  return patch as UpdateCourseInput;
}

export function OverviewSection({ course, writable }: SectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form>(() => formFrom(course));
  const [confirming, setConfirming] = useState<CourseStatus | null>(null);

  const refresh = async (data: CourseResponse) => {
    queryClient.setQueryData(courseKey(course.id), data);
    await queryClient.invalidateQueries({ queryKey: ['courses'] });
    // Status and toggle changes ripple into sessions and groups.
    await queryClient.invalidateQueries({ queryKey: courseKey(course.id) });
  };
  const patch = useMutation({
    mutationFn: (body: UpdateCourseInput) =>
      apiFetch<CourseResponse>(`/api/v1/courses/${course.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: refresh,
  });
  const status = useMutation({
    mutationFn: (next: CourseStatus) =>
      apiFetch<CourseResponse>(`/api/v1/courses/${course.id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: next }),
      }),
    onSuccess: async (data) => {
      setConfirming(null);
      await refresh(data);
    },
  });
  const bind = (key: keyof Form) => ({
    value: form[key],
    onChange: (e: { target: { value: string } }) =>
      setForm({ ...form, [key]: e.target.value }),
  });

  return (
    <Card title={t('courses.overview')}>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">{t('courses.lifecycle')}:</span>
        {COURSE_TRANSITIONS[course.status].map((next) =>
          confirming === next ? (
            <span key={next} className="flex gap-2">
              <Button
                variant={
                  next === 'FINISHED' || next === 'ARCHIVED'
                    ? 'danger'
                    : 'primary'
                }
                onClick={() => status.mutate(next)}
                disabled={status.isPending}
              >
                {t('courses.confirmMove', {
                  status: t(`courses.status.${next}`),
                })}
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(null)}>
                {t('common.cancel')}
              </Button>
            </span>
          ) : (
            <Button
              key={next}
              variant="ghost"
              onClick={() => setConfirming(next)}
            >
              → {t(`courses.status.${next}`)}
            </Button>
          ),
        )}
        {COURSE_TRANSITIONS[course.status].length === 0 ? (
          <span className="text-sm text-muted">—</span>
        ) : null}
      </div>
      {status.isError ? <ErrorText error={status.error} /> : null}

      {writable ? (
        <>
          <div className="mb-5 grid gap-2 rounded-xl bg-paper p-4 text-sm">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1 accent-accent"
                checked={course.isHierarchical}
                disabled={patch.isPending}
                onChange={(e) =>
                  patch.mutate({ isHierarchical: e.target.checked })
                }
              />
              <span>
                <span className="font-medium">{t('courses.hierarchical')}</span>
                <span className="block text-xs text-muted">
                  {t('courses.hierarchicalHint')}
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1 accent-accent"
                checked={course.hasGroups}
                disabled={patch.isPending || !course.isHierarchical}
                onChange={(e) => patch.mutate({ hasGroups: e.target.checked })}
              />
              <span>
                <span className="font-medium">{t('courses.groupsToggle')}</span>
                <span className="block text-xs text-muted">
                  {t('courses.groupsHint')}
                </span>
              </span>
            </label>
          </div>

          <details>
            <summary className="cursor-pointer text-sm font-medium text-accent">
              {t('courses.editDetails')}
            </summary>
            <form
              className="mt-4 grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                patch.mutate(patchFrom(form));
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t('courses.name')}>
                  <input className={inputClass} required {...bind('name')} />
                </Field>
                <Field label={t('courses.location')}>
                  <input className={inputClass} {...bind('location')} />
                </Field>
                <Field label={t('courses.startDate')}>
                  <input
                    type="date"
                    className={inputClass}
                    {...bind('startDate')}
                  />
                </Field>
                <Field label={t('courses.endDate')}>
                  <input
                    type="date"
                    className={inputClass}
                    {...bind('endDate')}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(
                  ['minAge', 'maxAge', 'capacity', 'testPassMark'] as const
                ).map((key) => (
                  <Field key={key} label={t(`courses.${key}`)}>
                    <input
                      type="number"
                      min={0}
                      dir="ltr"
                      className={inputClass}
                      {...bind(key)}
                    />
                  </Field>
                ))}
              </div>
              <Field label={t('courses.description')}>
                <textarea
                  className={`${inputClass} min-h-20 py-2`}
                  {...bind('description')}
                />
              </Field>
              <div>
                <Button type="submit" disabled={patch.isPending}>
                  {t('common.save')}
                </Button>
              </div>
            </form>
          </details>
        </>
      ) : null}
      {patch.isError ? (
        <div className="mt-3">
          <ErrorText error={patch.error} />
        </div>
      ) : null}
    </Card>
  );
}
