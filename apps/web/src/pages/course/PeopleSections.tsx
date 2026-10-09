import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  CourseResponse,
  CreateRequirementInput,
  EnrollmentResponse,
  EnrollmentWarning,
  EnrollResult,
  RequirementResponse,
  RequirementType,
  TeachingAssignmentResponse,
} from '@ribat/shared';
import { apiFetch } from '../../api/api-fetch';
import { courseKey } from '../../api/courses';
import { useMembers } from '../../api/members';
import { fullName } from '../../components/MemberCard';
import { Button } from '../../components/ui/button';
import {
  Badge,
  Card,
  Empty,
  ErrorText,
  inputClass,
} from '../../components/ui/form';
import type { SectionProps } from './types';

export function useTeachers(courseId: string) {
  return useQuery({
    queryKey: courseKey(courseId, 'teachers'),
    queryFn: () =>
      apiFetch<TeachingAssignmentResponse[]>(
        `/api/v1/courses/${courseId}/teachers`,
      ),
  });
}

export function useEnrollments(courseId: string) {
  return useQuery({
    queryKey: courseKey(courseId, 'enrollments'),
    queryFn: () =>
      apiFetch<EnrollmentResponse[]>(`/api/v1/courses/${courseId}/enrollments`),
  });
}

/** Member picker for staff. Members the list already contains are left out. */
function MemberPicker({
  exclude,
  onPick,
  label,
  pending,
}: {
  exclude: Set<string>;
  onPick: (memberId: string) => void;
  label: string;
  pending: boolean;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [memberId, setMemberId] = useState('');
  const members = useMembers('ACTIVE', search);
  return (
    <form
      className="mt-4 grid gap-2 border-t border-line pt-4 sm:grid-cols-[1fr_1fr_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        if (memberId) onPick(memberId);
        setMemberId('');
      }}
    >
      <input
        type="search"
        className={inputClass}
        placeholder={t('members.search')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <select
        className={inputClass}
        value={memberId}
        onChange={(e) => setMemberId(e.target.value)}
        required
      >
        <option value="">{t('common.choose')}</option>
        {(members.data ?? [])
          .filter((m) => !exclude.has(m.id))
          .map((m) => (
            <option key={m.id} value={m.id}>
              {fullName(m)} · {m.birthDate}
            </option>
          ))}
      </select>
      <Button type="submit" disabled={pending || !memberId}>
        {label}
      </Button>
    </form>
  );
}

export function TeachersSection({ course, staff, writable }: SectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const teachers = useTeachers(course.id);
  const refresh = (data: TeachingAssignmentResponse[]) =>
    queryClient.setQueryData(courseKey(course.id, 'teachers'), data);
  const add = useMutation({
    mutationFn: (body: { memberId: string; role?: 'LEAD' }) =>
      apiFetch<TeachingAssignmentResponse[]>(
        `/api/v1/courses/${course.id}/teachers`,
        {
          method: 'POST',
          body: JSON.stringify(body),
        },
      ),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (memberId: string) =>
      apiFetch<TeachingAssignmentResponse[]>(
        `/api/v1/courses/${course.id}/teachers/${memberId}`,
        { method: 'DELETE' },
      ),
    onSuccess: refresh,
  });
  const active = (teachers.data ?? []).filter((row) => !row.endedAt);
  const past = (teachers.data ?? []).filter((row) => row.endedAt);
  const canEdit = staff && writable;

  return (
    <Card title={t('teachers.title')}>
      {active.length === 0 ? <Empty>{t('teachers.empty')}</Empty> : null}
      <ul className="grid gap-2">
        {active.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-paper px-3 py-2 text-sm"
          >
            <span className="font-medium">{row.teacherName}</span>
            <span className="flex items-center gap-2">
              <Badge tone={row.role === 'LEAD' ? 'accent' : 'neutral'}>
                {t(`teachers.role.${row.role}`)}
              </Badge>
              {canEdit && row.role !== 'LEAD' ? (
                <button
                  type="button"
                  className="text-xs text-accent underline"
                  onClick={() =>
                    add.mutate({ memberId: row.teacherMemberId, role: 'LEAD' })
                  }
                >
                  {t('teachers.makeLead')}
                </button>
              ) : null}
              {canEdit ? (
                <button
                  type="button"
                  className="text-xs text-danger underline"
                  onClick={() => remove.mutate(row.teacherMemberId)}
                >
                  {t('common.remove')}
                </button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {past.length ? (
        <p className="mt-3 text-xs text-muted">
          {t('teachers.past')}: {past.map((row) => row.teacherName).join('، ')}
        </p>
      ) : null}
      {canEdit ? (
        <>
          {!course.isHierarchical && active.length > 0 ? (
            <p className="mt-3 text-xs text-muted">{t('teachers.oneOnly')}</p>
          ) : null}
          <MemberPicker
            exclude={new Set(active.map((row) => row.teacherMemberId))}
            onPick={(memberId) => add.mutate({ memberId })}
            label={t('teachers.add')}
            pending={add.isPending}
          />
        </>
      ) : null}
      {add.isError ? <ErrorText error={add.error} /> : null}
      {remove.isError ? <ErrorText error={remove.error} /> : null}
    </Card>
  );
}

export function StudentsSection({ course, staff, writable }: SectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const enrollments = useEnrollments(course.id);
  const [warnings, setWarnings] = useState<{
    name: string;
    list: EnrollmentWarning[];
  } | null>(null);
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: courseKey(course.id, 'enrollments'),
    });
  const enroll = useMutation({
    mutationFn: (memberId: string) =>
      apiFetch<EnrollResult>(`/api/v1/courses/${course.id}/enrollments`, {
        method: 'POST',
        body: JSON.stringify({ memberId }),
      }),
    onSuccess: async (result) => {
      setWarnings(
        result.warnings.length
          ? { name: result.enrollment.memberName, list: result.warnings }
          : null,
      );
      await refresh();
    },
  });
  const withdraw = useMutation({
    mutationFn: (enrollmentId: string) =>
      apiFetch(`/api/v1/courses/${course.id}/enrollments/${enrollmentId}`, {
        method: 'DELETE',
      }),
    onSuccess: async () => {
      await refresh();
      await queryClient.invalidateQueries({
        queryKey: courseKey(course.id, 'groups'),
      });
    },
  });
  const active = (enrollments.data ?? []).filter((e) => e.status === 'ACTIVE');
  const others = (enrollments.data ?? []).filter((e) => e.status !== 'ACTIVE');
  const canEdit = staff && writable;

  return (
    <Card
      title={t('students.title')}
      actions={
        <span className="text-sm text-muted">
          {active.length}
          {course.capacity ? ` / ${course.capacity}` : ''}
        </span>
      }
    >
      {staff ? <RequirementsBlock course={course} canEdit={canEdit} /> : null}
      {active.length === 0 ? <Empty>{t('students.empty')}</Empty> : null}
      <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {active.map((row) => (
          <li
            key={row.id}
            className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-paper"
          >
            <span>{row.memberName}</span>
            {canEdit ? (
              <button
                type="button"
                className="text-xs text-danger underline"
                onClick={() => withdraw.mutate(row.id)}
              >
                {t('students.withdraw')}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {others.length ? (
        <p className="mt-3 text-xs text-muted">
          {others
            .map(
              (row) =>
                `${row.memberName} (${t(`students.status.${row.status}`)})`,
            )
            .join('، ')}
        </p>
      ) : null}
      {warnings ? (
        <div
          role="status"
          className="mt-4 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          <p className="font-medium">
            {t('students.enrolledWithWarnings', { name: warnings.name })}
          </p>
          <ul className="mt-1 list-disc ps-5 text-xs">
            {warnings.list.map((w) => (
              <li key={w.code + w.message}>
                {t(`students.warning.${w.code}`)} —{' '}
                <span dir="auto">{w.message}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {canEdit ? (
        <MemberPicker
          exclude={new Set(active.map((row) => row.memberId))}
          onPick={(memberId) => enroll.mutate(memberId)}
          label={t('students.enroll')}
          pending={enroll.isPending}
        />
      ) : null}
      {enroll.isError ? <ErrorText error={enroll.error} /> : null}
      {withdraw.isError ? <ErrorText error={withdraw.error} /> : null}
    </Card>
  );
}

const REQUIREMENT_TYPES: RequirementType[] = [
  'MIN_AGE',
  'MAX_AGE',
  'COMPLETED_COURSE',
  'MANUAL',
];

/** T203: soft conditions, checked at enrollment and shown as warnings. */
function RequirementsBlock({
  course,
  canEdit,
}: {
  course: CourseResponse;
  canEdit: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const key = courseKey(course.id, 'requirements');
  const requirements = useQuery({
    queryKey: key,
    queryFn: () =>
      apiFetch<RequirementResponse[]>(
        `/api/v1/courses/${course.id}/requirements`,
      ),
  });
  const courses = useQuery({
    queryKey: ['courses', 'all'],
    queryFn: () => apiFetch<CourseResponse[]>('/api/v1/courses'),
    enabled: canEdit,
  });
  const [type, setType] = useState<RequirementType>('MANUAL');
  const [value, setValue] = useState('');
  const add = useMutation({
    mutationFn: () => {
      const body: CreateRequirementInput =
        type === 'MIN_AGE' || type === 'MAX_AGE'
          ? { type, years: Number(value) }
          : type === 'COMPLETED_COURSE'
            ? { type, courseId: value }
            : { type, description: value.trim() };
      return apiFetch(`/api/v1/courses/${course.id}/requirements`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      setValue('');
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/courses/${course.id}/requirements/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  const courseName = (id: string | null) =>
    courses.data?.find((c) => c.id === id)?.name ?? '—';
  const describe = (r: RequirementResponse) =>
    r.type === 'MIN_AGE' || r.type === 'MAX_AGE'
      ? t(`requirements.${r.type}`, { years: r.years })
      : r.type === 'COMPLETED_COURSE'
        ? t('requirements.COMPLETED_COURSE', {
            name: courseName(r.requiredCourseId),
          })
        : r.description;

  return (
    <div className="mb-4 rounded-xl bg-paper p-3 text-sm">
      <p className="text-xs font-medium text-muted">
        {t('requirements.title')}
      </p>
      <ul className="mt-1 flex flex-wrap gap-2">
        {(requirements.data ?? []).map((r) => (
          <li
            key={r.id}
            className="flex items-center gap-1 rounded-full bg-surface px-3 py-1 text-xs"
          >
            <span dir="auto">{describe(r)}</span>
            {canEdit ? (
              <button
                type="button"
                aria-label={t('common.remove')}
                className="text-danger"
                onClick={() => remove.mutate(r.id)}
              >
                ×
              </button>
            ) : null}
          </li>
        ))}
        {requirements.data?.length === 0 ? (
          <li className="text-xs text-muted">{t('requirements.none')}</li>
        ) : null}
      </ul>
      {canEdit ? (
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <select
            className={`${inputClass} w-auto`}
            value={type}
            onChange={(e) => {
              setType(e.target.value as RequirementType);
              setValue('');
            }}
          >
            {REQUIREMENT_TYPES.map((value) => (
              <option key={value} value={value}>
                {t(`requirements.type.${value}`)}
              </option>
            ))}
          </select>
          {type === 'COMPLETED_COURSE' ? (
            <select
              className={`${inputClass} w-auto min-w-40`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            >
              <option value="">{t('common.choose')}</option>
              {(courses.data ?? [])
                .filter((c) => c.id !== course.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          ) : (
            <input
              className={`${inputClass} w-auto min-w-40 flex-1`}
              type={type === 'MANUAL' ? 'text' : 'number'}
              min={0}
              placeholder={
                type === 'MANUAL'
                  ? t('requirements.manualPlaceholder')
                  : t('requirements.years')
              }
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
          )}
          <Button type="submit" variant="ghost" disabled={add.isPending}>
            {t('requirements.add')}
          </Button>
        </form>
      ) : null}
      {add.isError ? <ErrorText error={add.error} /> : null}
    </div>
  );
}
