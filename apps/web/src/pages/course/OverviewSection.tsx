import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  CourseResponse,
  CourseStatus,
  ScheduleRuleResponse,
  TeachingAssignmentResponse,
  CustomValues,
  UpdateCourseInput,
} from '@ribat/shared';
import { apiFetch } from '../../api/api-fetch';
import { courseKey } from '../../api/courses';
import { CustomFieldsSection } from '../../components/CustomFieldsSection';
import { CourseForm, type CourseFormValues } from '../../components/CourseForm';
import { Button } from '../../components/ui/button';
import { Card, ErrorText, Field, inputClass } from '../../components/ui/form';
import { saveCourseExtras } from '../../lib/course-save';
import { COURSE_TRANSITIONS } from '../../lib/domain';
import type { SectionProps } from './types';

type ExtraForm = {
  description: string;
  minAge: string;
  maxAge: string;
  capacity: string;
  testPassMark: string;
};

const extraFrom = (c: CourseResponse): ExtraForm => ({
  description: c.description ?? '',
  minAge: c.minAge?.toString() ?? '',
  maxAge: c.maxAge?.toString() ?? '',
  capacity: c.capacity?.toString() ?? '',
  testPassMark: c.testPassMark.toString(),
});

function extraPatch(form: ExtraForm): UpdateCourseInput {
  const patch: Record<string, string | number> = {};
  if (form.description.trim()) patch.description = form.description.trim();
  for (const key of ['minAge', 'maxAge', 'capacity', 'testPassMark'] as const) {
    if (form[key] !== '') patch[key] = Number(form[key]);
  }
  return patch as UpdateCourseInput;
}

export function OverviewSection({ course, writable }: SectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<CourseStatus | null>(null);
  const [extra, setExtra] = useState<ExtraForm>(() => extraFrom(course));
  const [customValues, setCustomValues] = useState<CustomValues>(
    () => course.customValues ?? {},
  );

  const schedule = useQuery({
    queryKey: courseKey(course.id, 'schedule'),
    queryFn: () =>
      apiFetch<ScheduleRuleResponse[]>(
        `/api/v1/courses/${course.id}/schedule`,
      ),
  });
  const teachers = useQuery({
    queryKey: courseKey(course.id, 'teachers'),
    queryFn: () =>
      apiFetch<TeachingAssignmentResponse[]>(
        `/api/v1/courses/${course.id}/teachers`,
      ),
  });
  const lead =
    (teachers.data ?? []).find((row) => !row.endedAt && row.role === 'LEAD') ??
    (teachers.data ?? []).find((row) => !row.endedAt);

  const refresh = async (data: CourseResponse) => {
    queryClient.setQueryData(courseKey(course.id), data);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['courses'] }),
      queryClient.invalidateQueries({ queryKey: courseKey(course.id) }),
      queryClient.invalidateQueries({
        queryKey: courseKey(course.id, 'schedule'),
      }),
      queryClient.invalidateQueries({
        queryKey: courseKey(course.id, 'teachers'),
      }),
    ]);
  };

  const save = useMutation({
    mutationFn: async (values: CourseFormValues) => {
      const body: UpdateCourseInput = {
        name: values.name,
        type: values.type,
        programId: values.programId || null,
      };
      Object.assign(body, extraPatch(extra));
      body.customValues = customValues;
      const updated = await apiFetch<CourseResponse>(
        `/api/v1/courses/${course.id}`,
        { method: 'PATCH', body: JSON.stringify(body) },
      );
      await saveCourseExtras(course.id, values);
      return updated;
    },
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
  const patch = useMutation({
    mutationFn: (body: UpdateCourseInput) =>
      apiFetch<CourseResponse>(`/api/v1/courses/${course.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: refresh,
  });

  const formReady =
    !schedule.isLoading &&
    !teachers.isLoading &&
    schedule.data !== undefined &&
    teachers.data !== undefined;

  const rules =
    schedule.data?.map(({ weekday, start, end }) => ({
      weekday,
      start,
      end,
    })) ?? [];

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

          {schedule.isError || teachers.isError ? (
            <ErrorText error={schedule.error ?? teachers.error} />
          ) : null}
          {formReady ? (
            <CourseForm
              key={`${course.id}-overview`}
              initial={{
                name: course.name,
                type: course.type,
                programId: course.programId ?? '',
                teacherMemberId: lead?.teacherMemberId ?? '',
                rules,
              }}
              submitLabel={t('common.save')}
              pending={save.isPending}
              onSubmit={(values) => save.mutate(values)}
            />
          ) : (
            <p className="text-sm text-muted">…</p>
          )}
          <CustomFieldsSection
            entityType="COURSE"
            values={customValues}
            onChange={setCustomValues}
          />

          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-accent">
              {t('courses.moreDetails')}
            </summary>
            <form
              className="mt-4 grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                patch.mutate(extraPatch(extra));
              }}
            >
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
                      value={extra[key]}
                      onChange={(e) =>
                        setExtra({ ...extra, [key]: e.target.value })
                      }
                    />
                  </Field>
                ))}
              </div>
              <Field label={t('courses.description')}>
                <textarea
                  className={`${inputClass} min-h-20 py-2`}
                  value={extra.description}
                  onChange={(e) =>
                    setExtra({ ...extra, description: e.target.value })
                  }
                />
              </Field>
              <Button type="submit" disabled={patch.isPending}>
                {t('common.save')}
              </Button>
            </form>
          </details>
        </>
      ) : null}
      {save.isError || patch.isError ? (
        <div className="mt-3">
          <ErrorText error={save.error ?? patch.error} />
        </div>
      ) : null}
    </Card>
  );
}
