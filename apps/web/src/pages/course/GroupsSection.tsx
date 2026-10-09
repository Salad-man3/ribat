import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CourseMaterialResponse, GroupResponse } from '@ribat/shared';
import { apiFetch } from '../../api/api-fetch';
import { courseKey } from '../../api/courses';
import { Button } from '../../components/ui/button';
import {
  Badge,
  Card,
  Empty,
  ErrorText,
  inputClass,
} from '../../components/ui/form';
import { useEnrollments, useTeachers } from './PeopleSections';
import type { SectionProps } from './types';

/**
 * T206. A group is one teacher's students, for every material or for one (decision 5.4).
 * DM-06: a student has one teacher per material. The picker hides students who already
 * have one, and the API refuses the rest.
 */
export function GroupsSection({ course, staff, writable }: SectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const key = courseKey(course.id, 'groups');
  const groups = useQuery({
    queryKey: key,
    queryFn: () =>
      apiFetch<GroupResponse[]>(`/api/v1/courses/${course.id}/groups`),
  });
  const materials = useQuery({
    queryKey: courseKey(course.id, 'materials'),
    queryFn: () =>
      apiFetch<CourseMaterialResponse[]>(
        `/api/v1/courses/${course.id}/materials`,
      ),
  });
  const teachers = useTeachers(course.id);
  const enrollments = useEnrollments(course.id);
  const [name, setName] = useState('');
  const [teacherMemberId, setTeacher] = useState('');
  const [materialId, setMaterial] = useState('');
  const canEdit = staff && writable;

  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const call = (path: string, method: string, body?: object) =>
    apiFetch(`/api/v1/courses/${course.id}/groups${path}`, {
      method,
      body: body ? JSON.stringify(body) : undefined,
    });
  const create = useMutation({
    mutationFn: () =>
      call('', 'POST', {
        name,
        teacherMemberId,
        ...(materialId ? { materialId } : {}),
      }),
    onSuccess: async () => {
      setName('');
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => call(`/${id}`, 'DELETE'),
    onSuccess: refresh,
  });
  const addStudent = useMutation({
    mutationFn: (v: { groupId: string; enrollmentId: string }) =>
      call(`/${v.groupId}/students`, 'POST', { enrollmentId: v.enrollmentId }),
    onSuccess: refresh,
  });
  const removeStudent = useMutation({
    mutationFn: (v: { groupId: string; enrollmentId: string }) =>
      call(`/${v.groupId}/students/${v.enrollmentId}`, 'DELETE'),
    onSuccess: refresh,
  });

  const activeEnrollments = (enrollments.data ?? []).filter(
    (e) => e.status === 'ACTIVE',
  );
  const nameOf = (enrollmentId: string) =>
    activeEnrollments.find((e) => e.id === enrollmentId)?.memberName ??
    enrollmentId.slice(0, 8);
  /** Students who could still join this group without a second teacher for its material. */
  const candidates = (group: GroupResponse) =>
    activeEnrollments.filter(
      (e) =>
        !(groups.data ?? []).some(
          (g) =>
            g.enrollmentIds.includes(e.id) &&
            (g.id === group.id ||
              g.materialId === null ||
              group.materialId === null ||
              g.materialId === group.materialId),
        ),
    );
  const error =
    create.error ?? remove.error ?? addStudent.error ?? removeStudent.error;

  return (
    <Card title={t('groups.title')}>
      {groups.data?.length === 0 ? <Empty>{t('groups.empty')}</Empty> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {(groups.data ?? []).map((group) => (
          <article key={group.id} className="rounded-xl border border-line p-3">
            <header className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{group.name}</p>
                <p className="text-xs text-muted">{group.teacherName}</p>
              </div>
              <span className="flex items-center gap-2">
                <Badge tone="accent">
                  {group.materialTitle ?? t('groups.allMaterials')}
                </Badge>
                {canEdit ? (
                  <button
                    type="button"
                    className="text-xs text-danger underline"
                    onClick={() => remove.mutate(group.id)}
                  >
                    {t('common.remove')}
                  </button>
                ) : null}
              </span>
            </header>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {group.enrollmentIds.map((enrollmentId) => (
                <li
                  key={enrollmentId}
                  className="flex items-center gap-1 rounded-full bg-paper px-2.5 py-1 text-xs"
                >
                  {nameOf(enrollmentId)}
                  {canEdit ? (
                    <button
                      type="button"
                      aria-label={t('common.remove')}
                      className="text-danger"
                      onClick={() =>
                        removeStudent.mutate({
                          groupId: group.id,
                          enrollmentId,
                        })
                      }
                    >
                      ×
                    </button>
                  ) : null}
                </li>
              ))}
              {group.enrollmentIds.length === 0 ? (
                <li className="text-xs text-muted">{t('groups.noStudents')}</li>
              ) : null}
            </ul>
            {canEdit && candidates(group).length ? (
              <select
                className={`${inputClass} mt-2 min-h-9 text-xs`}
                value=""
                onChange={(e) =>
                  e.target.value &&
                  addStudent.mutate({
                    groupId: group.id,
                    enrollmentId: e.target.value,
                  })
                }
              >
                <option value="">+ {t('groups.addStudent')}</option>
                {candidates(group).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.memberName}
                  </option>
                ))}
              </select>
            ) : null}
          </article>
        ))}
      </div>

      {canEdit ? (
        <form
          className="mt-4 grid gap-2 border-t border-line pt-4 sm:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <input
            className={inputClass}
            placeholder={t('groups.name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <select
            className={inputClass}
            value={teacherMemberId}
            onChange={(e) => setTeacher(e.target.value)}
            required
          >
            <option value="">{t('groups.teacher')}</option>
            {(teachers.data ?? [])
              .filter((row) => !row.endedAt)
              .map((row) => (
                <option key={row.teacherMemberId} value={row.teacherMemberId}>
                  {row.teacherName}
                </option>
              ))}
          </select>
          <select
            className={inputClass}
            value={materialId}
            onChange={(e) => setMaterial(e.target.value)}
          >
            <option value="">{t('groups.allMaterials')}</option>
            {(materials.data ?? []).map((m) => (
              <option key={m.materialId} value={m.materialId}>
                {m.material.title}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={create.isPending}>
            {t('groups.create')}
          </Button>
        </form>
      ) : null}
      {error ? (
        <div className="mt-3">
          <ErrorText error={error} />
        </div>
      ) : null}
    </Card>
  );
}
