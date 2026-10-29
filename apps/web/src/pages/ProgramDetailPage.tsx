import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import type {
  CourseResponse,
  ProgramResponse,
  CustomValues,
  UpdateProgramInput,
} from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { CustomFieldsSection } from '../components/CustomFieldsSection';
import { Button } from '../components/ui/button';
import {
  Badge,
  Card,
  Empty,
  ErrorText,
  Field,
  inputClass,
} from '../components/ui/form';
import { NotFoundPage } from './NotFoundPage';
import { statusTone } from './CoursesPage';

function ProgramEditForm({ program }: { program: ProgramResponse }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState(program.name);
  const [startDate, setStartDate] = useState(program.startDate ?? '');
  const [endDate, setEndDate] = useState(program.endDate ?? '');
  const [customValues, setCustomValues] = useState<CustomValues>(
    () => program.customValues ?? {},
  );

  const save = useMutation({
    mutationFn: (input: UpdateProgramInput) =>
      apiFetch<ProgramResponse>(`/api/v1/programs/${program.id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['programs'] });
    },
  });

  return (
    <Card title={t('courses.programSave')}>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate({
            name,
            startDate: startDate || null,
            endDate: endDate || null,
            customValues,
          });
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
        <div className="sm:col-span-2">
          <CustomFieldsSection
            entityType="PROGRAM"
            values={customValues}
            onChange={setCustomValues}
          />
        </div>
        <div className="flex items-end sm:col-span-2">
          <Button type="submit" disabled={save.isPending}>
            {t('courses.programSave')}
          </Button>
        </div>
      </form>
      {save.isError ? <ErrorText error={save.error} /> : null}
    </Card>
  );
}

export function ProgramDetailPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();

  const programs = useQuery({
    queryKey: ['programs'],
    queryFn: () => apiFetch<ProgramResponse[]>('/api/v1/programs'),
  });
  const courses = useQuery({
    queryKey: ['courses', 'CURRENT'],
    queryFn: () => apiFetch<CourseResponse[]>('/api/v1/courses'),
  });

  const program = (programs.data ?? []).find((p) => p.id === id);
  const halaqat = (courses.data ?? []).filter((c) => c.programId === id);

  if (programs.isSuccess && !program) return <NotFoundPage />;
  if (programs.isError) return <ErrorText error={programs.error} />;
  if (!program) return <p className="text-sm text-muted">…</p>;

  const formKey = [program.name, program.startDate, program.endDate].join('|');

  return (
    <section className="grid gap-6">
      <Link to="/staff/courses" className="text-sm text-accent">
        <span className="inline-block rtl:rotate-180">←</span>{' '}
        {t('courses.title')}
      </Link>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {program.name}
        </h1>
        <p className="mt-1 text-sm text-muted">{t('courses.program')}</p>
      </header>

      <ProgramEditForm key={formKey} program={program} />

      <Card title={t('courses.programHalaqat')}>
        {courses.isError ? <ErrorText error={courses.error} /> : null}
        {halaqat.length === 0 ? (
          <Empty>{t('courses.programEmpty')}</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {halaqat.map((course) => (
              <li key={course.id}>
                <Link
                  to={`/staff/courses/${course.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-3 hover:bg-paper"
                >
                  <span>
                    <span className="block font-medium">{course.name}</span>
                    <span className="block text-xs text-muted">
                      {t(`courses.type.${course.type}`)}
                    </span>
                  </span>
                  <Badge tone={statusTone(course.status)}>
                    {t(`courses.status.${course.status}`)}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
