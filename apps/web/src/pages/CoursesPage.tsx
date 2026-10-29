import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { NavButton } from '../components/ui/nav-button';
import { formatDate } from '../lib/domain';
import type {
  CourseResponse,
  CourseStatus,
  CreateCourseInput,
  CreateProgramInput,
  CustomValues,
  ProgramResponse,
} from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { CustomFieldsSection } from '../components/CustomFieldsSection';
import { CourseForm, type CourseFormValues } from '../components/CourseForm';
import { saveCourseExtras } from '../lib/course-save';
import { Button } from '../components/ui/button';
import {
  Badge,
  Card,
  Empty,
  ErrorText,
  Field,
  inputClass,
  PageHeader,
  RecordRow,
  Segmented,
} from '../components/ui/form';
const FILTERS: (CourseStatus | 'CURRENT')[] = [
  'CURRENT',
  'DRAFT',
  'ACTIVE',
  'PAUSED',
  'FINISHED',
  'ARCHIVED',
];

export function statusTone(status: CourseStatus) {
  return status === 'ACTIVE'
    ? 'accent'
    : status === 'PAUSED'
      ? 'danger'
      : 'neutral';
}

export function CoursesPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'courses' | 'programs'>('courses');
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
      <PageHeader
        chrome
        title={t('courses.title')}
        subtitle={t('courses.subtitle')}
      />
      <Segmented
        value={tab}
        onChange={setTab}
        aria-label={t('courses.title')}
        options={(['courses', 'programs'] as const).map((value) => ({
          value,
          label: t(`courses.tab.${value}`),
        }))}
      />
      {tab === 'courses' ? (
        <>
          <NewCourse />
          <Card>
            <div className="mb-4">
              <Segmented
                value={filter}
                onChange={setFilter}
                aria-label={t('courses.title')}
                options={FILTERS.map((value) => ({
                  value,
                  label:
                    value === 'CURRENT'
                      ? t('courses.current')
                      : t(`courses.status.${value}`),
                }))}
              />
            </div>
            {courses.isError ? <ErrorText error={courses.error} /> : null}
            {courses.data?.length === 0 ? (
              <Empty>{t('courses.empty')}</Empty>
            ) : null}
            <ul className="divide-y divide-line">
              {(courses.data ?? []).map((course) => (
                <li key={course.id}>
                  <RecordRow
                    to={`/staff/courses/${course.id}`}
                    title={course.name}
                    meta={t(`courses.type.${course.type}`)}
                    badge={
                      <Badge tone={statusTone(course.status)}>
                        {t(`courses.status.${course.status}`)}
                      </Badge>
                    }
                  />
                </li>
              ))}
            </ul>
          </Card>
        </>
      ) : (
        <ProgramsPanel />
      )}
    </section>
  );
}

function NewCourse() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [customValues, setCustomValues] = useState<CustomValues>({});
  const create = useMutation({
    mutationFn: async (values: CourseFormValues) => {
      const body: CreateCourseInput = { name: values.name, type: values.type };
      if (values.programId) body.programId = values.programId;
      if (Object.keys(customValues).length) body.customValues = customValues;
      const course = await apiFetch<CourseResponse>('/api/v1/courses', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      await saveCourseExtras(course.id, values);
      return course;
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
      <div className="border-t border-line p-5 grid gap-4">
        <CourseForm
          submitLabel={t('courses.create')}
          pending={create.isPending}
          onSubmit={(values) => create.mutate(values)}
        />
        <CustomFieldsSection
          entityType="COURSE"
          values={customValues}
          onChange={setCustomValues}
        />
        {create.isError ? <ErrorText error={create.error} /> : null}
      </div>
    </details>
  );
}

function programDateRange(
  p: ProgramResponse,
  locale: string,
  t: (key: string) => string,
) {
  if (p.startDate && p.endDate) {
    return `${formatDate(p.startDate, locale)} – ${formatDate(p.endDate, locale)}`;
  }
  if (p.startDate) return formatDate(p.startDate, locale);
  if (p.endDate) return formatDate(p.endDate, locale);
  return t('courses.programDatesUnset');
}

function ProgramsPanel() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customValues, setCustomValues] = useState<CustomValues>({});
  const programs = useQuery({
    queryKey: ['programs'],
    queryFn: () => apiFetch<ProgramResponse[]>('/api/v1/programs'),
  });
  const create = useMutation({
    mutationFn: (input: CreateProgramInput) =>
      apiFetch<ProgramResponse>('/api/v1/programs', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      setName('');
      setStartDate('');
      setEndDate('');
      setCustomValues({});
      void queryClient.invalidateQueries({ queryKey: ['programs'] });
    },
  });

  return (
    <Card title={t('courses.programsTitle')}>
      <form
        className="mb-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const input: CreateProgramInput = { name };
          if (startDate) input.startDate = startDate;
          if (endDate) input.endDate = endDate;
          if (Object.keys(customValues).length) input.customValues = customValues;
          create.mutate(input);
        }}
      >
        <Field label={t('courses.programName')}>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>
        <Field label={t('courses.startDate')}>
          <input
            type="date"
            className={inputClass}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </Field>
        <Field label={t('courses.endDate')}>
          <input
            type="date"
            className={inputClass}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </Field>
        <div className="flex items-end">
          <Button type="submit" disabled={create.isPending}>
            {t('courses.programCreate')}
          </Button>
        </div>
        <div className="w-full">
          <CustomFieldsSection
            entityType="PROGRAM"
            values={customValues}
            onChange={setCustomValues}
          />
        </div>
      </form>
      {create.isError ? <ErrorText error={create.error} /> : null}
      <ul className="divide-y divide-line">
        {(programs.data ?? []).map((p) => (
          <li key={p.id}>
            <NavButton
              to={`/staff/programs/${p.id}`}
              className="block w-full rounded-lg px-2 py-3 text-start hover:bg-paper"
            >
              <span className="block font-medium">{p.name}</span>
              <span className="block text-xs text-muted">
                {programDateRange(p, i18n.language, t)}
              </span>
            </NavButton>
          </li>
        ))}
      </ul>
    </Card>
  );
}
