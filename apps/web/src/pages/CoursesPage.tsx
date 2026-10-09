import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import type {
  CourseResponse,
  CourseStatus,
  CourseType,
  CreateCourseInput,
} from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { Button } from '../components/ui/button';
import {
  Badge,
  Card,
  Empty,
  ErrorText,
  Field,
  inputClass,
  PageHeader,
} from '../components/ui/form';
import { cn } from '../lib/utils';

const FILTERS: (CourseStatus | 'CURRENT')[] = [
  'CURRENT',
  'DRAFT',
  'ACTIVE',
  'PAUSED',
  'FINISHED',
  'ARCHIVED',
];
const TYPES: CourseType[] = ['MEMORIZATION', 'EXPLANATION', 'BOTH'];

export function statusTone(status: CourseStatus) {
  return status === 'ACTIVE'
    ? 'accent'
    : status === 'PAUSED'
      ? 'danger'
      : 'neutral';
}

export function CoursesPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('CURRENT');
  const courses = useQuery({
    queryKey: ['courses', filter],
    queryFn: () =>
      apiFetch<CourseResponse[]>(
        `/api/v1/courses${filter === 'CURRENT' ? '' : `?status=${filter}`}`,
      ),
  });

  return (
    <section className="grid gap-6">
      <PageHeader title={t('courses.title')} subtitle={t('courses.subtitle')} />
      <NewCourse />
      <Card>
        <div className="mb-4 flex flex-wrap gap-1">
          {FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm',
                filter === value
                  ? 'bg-accent text-white'
                  : 'text-muted hover:bg-paper hover:text-ink',
              )}
            >
              {value === 'CURRENT'
                ? t('courses.current')
                : t(`courses.status.${value}`)}
            </button>
          ))}
        </div>
        {courses.isError ? <ErrorText error={courses.error} /> : null}
        {courses.data?.length === 0 ? (
          <Empty>{t('courses.empty')}</Empty>
        ) : null}
        <ul className="divide-y divide-line">
          {(courses.data ?? []).map((course) => (
            <li key={course.id}>
              <Link
                to={`/staff/courses/${course.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-3 hover:bg-paper"
              >
                <span>
                  <span className="block font-medium">{course.name}</span>
                  <span className="block text-xs text-muted">
                    {t(`courses.type.${course.type}`)}
                    {course.location ? ` · ${course.location}` : ''}
                  </span>
                </span>
                <Badge tone={statusTone(course.status)}>
                  {t(`courses.status.${course.status}`)}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

function NewCourse() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    type: 'MEMORIZATION' as CourseType,
    location: '',
    startDate: '',
  });
  const create = useMutation({
    mutationFn: () => {
      const body: CreateCourseInput = { name: form.name, type: form.type };
      if (form.location.trim()) body.location = form.location.trim();
      if (form.startDate) body.startDate = form.startDate;
      return apiFetch<CourseResponse>('/api/v1/courses', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: async (course) => {
      await queryClient.invalidateQueries({ queryKey: ['courses'] });
      navigate(`/staff/courses/${course.id}`);
    },
  });

  return (
    <details className="rounded-2xl border border-line bg-surface">
      <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-accent">
        + {t('courses.create')}
      </summary>
      <form
        className="grid gap-4 border-t border-line p-5"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('courses.name')}>
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </Field>
          <Field label={t('courses.typeLabel')}>
            <select
              className={inputClass}
              value={form.type}
              onChange={(e) =>
                setForm({ ...form, type: e.target.value as CourseType })
              }
            >
              {TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`courses.type.${type}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('courses.location')}>
            <input
              className={inputClass}
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </Field>
          <Field label={t('courses.startDate')}>
            <input
              type="date"
              className={inputClass}
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </Field>
        </div>
        <p className="text-xs text-muted">{t('courses.createHint')}</p>
        {create.isError ? <ErrorText error={create.error} /> : null}
        <div>
          <Button type="submit" disabled={create.isPending}>
            {t('courses.create')}
          </Button>
        </div>
      </form>
    </details>
  );
}
