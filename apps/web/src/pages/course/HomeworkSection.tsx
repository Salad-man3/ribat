import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  CreateHomeworkInput,
  EnrollmentResponse,
  GroupResponse,
  HomeworkResponse,
  HomeworkTarget,
  HomeworkTaskResponse,
  HomeworkTaskStatus,
} from '@ribat/shared';
import { apiFetch } from '../../api/api-fetch';
import { courseKey } from '../../api/courses';
import { Button } from '../../components/ui/button';
import { Badge, Card, Empty, ErrorText, Field, inputClass } from '../../components/ui/form';
import { formatDate, today } from '../../lib/domain';
import type { SectionProps } from './types';

/** T405, decision 10.2: assign to the course, a group or one student; mark done. */
export function HomeworkSection({ course, writable }: SectionProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const key = courseKey(course.id, 'homework');
  const homework = useQuery({
    queryKey: key,
    queryFn: () => apiFetch<HomeworkResponse[]>(`/api/v1/homework?courseId=${course.id}`),
  });
  const enrollments = useQuery({
    queryKey: courseKey(course.id, 'enrollments'),
    queryFn: () => apiFetch<EnrollmentResponse[]>(`/api/v1/courses/${course.id}/enrollments`),
  });
  const groups = useQuery({
    queryKey: courseKey(course.id, 'groups'),
    queryFn: () => apiFetch<GroupResponse[]>(`/api/v1/courses/${course.id}/groups`),
    enabled: course.hasGroups,
  });
  const [form, setForm] = useState({ targetType: 'COURSE' as HomeworkTarget, targetId: '', title: '', dueDate: today() });
  const [open, setOpen] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: (body: CreateHomeworkInput) =>
      apiFetch<HomeworkResponse>('/api/v1/homework', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      setForm({ ...form, title: '' });
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });

  const active = (enrollments.data ?? []).filter((e) => e.status === 'ACTIVE');

  return (
    <Card title={t('homework.title')}>
      {writable ? (
        <form
          className="mb-4 grid gap-2 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({
              courseId: course.id,
              targetType: form.targetType,
              ...(form.targetType === 'GROUP' ? { groupId: form.targetId } : {}),
              ...(form.targetType === 'MEMBER' ? { memberId: form.targetId } : {}),
              title: form.title,
              dueDate: form.dueDate,
            });
          }}
        >
          <Field label={t('homework.what')} className="sm:col-span-2">
            <input className={inputClass} required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label={t('homework.target')}>
            <select
              className={inputClass}
              value={form.targetType}
              onChange={(e) => setForm({ ...form, targetType: e.target.value as HomeworkTarget, targetId: '' })}
            >
              <option value="COURSE">{t('homework.targetType.COURSE')}</option>
              {course.hasGroups ? <option value="GROUP">{t('homework.targetType.GROUP')}</option> : null}
              <option value="MEMBER">{t('homework.targetType.MEMBER')}</option>
            </select>
          </Field>
          {form.targetType === 'GROUP' ? (
            <Field label={t('homework.targetType.GROUP')}>
              <select className={inputClass} required value={form.targetId} onChange={(e) => setForm({ ...form, targetId: e.target.value })}>
                <option value="" />
                {(groups.data ?? []).map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </Field>
          ) : form.targetType === 'MEMBER' ? (
            <Field label={t('homework.targetType.MEMBER')}>
              <select className={inputClass} required value={form.targetId} onChange={(e) => setForm({ ...form, targetId: e.target.value })}>
                <option value="" />
                {active.map((e) => (
                  <option key={e.id} value={e.memberId}>{e.memberName}</option>
                ))}
              </select>
            </Field>
          ) : (
            <span />
          )}
          <Field label={t('homework.due')}>
            <input type="date" className={inputClass} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </Field>
          <div className="flex items-end">
            <Button type="submit" disabled={create.isPending} className="w-full">{t('homework.assign')}</Button>
          </div>
          {create.isError ? <div className="sm:col-span-2"><ErrorText error={create.error} /></div> : null}
        </form>
      ) : null}

      {homework.isError ? <ErrorText error={homework.error} /> : null}
      {homework.data?.length === 0 ? <Empty>{t('homework.empty')}</Empty> : null}
      <ul className="grid gap-2">
        {(homework.data ?? []).map((h) => (
          <li key={h.id} className="rounded-lg bg-paper px-3 py-2 text-sm">
            <button type="button" className="flex w-full items-center justify-between gap-2 text-start" onClick={() => setOpen(open === h.id ? null : h.id)}>
              <span className="grid">
                <span className="font-medium">{h.title}</span>
                <span className="text-xs text-muted">
                  {t(`homework.targetType.${h.targetType}`)} · {t('family.due', { date: formatDate(h.dueDate, i18n.language) })}
                </span>
              </span>
              <span className="flex gap-1">
                <Badge tone="accent">{t('homework.status.DONE')} {h.counts.DONE}</Badge>
                <Badge>{t('homework.status.ASSIGNED')} {h.counts.ASSIGNED}</Badge>
                {h.counts.MISSED ? <Badge tone="danger">{t('homework.status.MISSED')} {h.counts.MISSED}</Badge> : null}
              </span>
            </button>
            {open === h.id ? <Tasks homeworkId={h.id} courseId={course.id} writable={writable} /> : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Tasks({ homeworkId, courseId, writable }: { homeworkId: string; courseId: string; writable: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const tasks = useQuery({
    queryKey: ['homework', homeworkId, 'tasks'],
    queryFn: () => apiFetch<HomeworkTaskResponse[]>(`/api/v1/homework/${homeworkId}/tasks`),
  });
  const mark = useMutation({
    mutationFn: ({ id, status }: { id: string; status: HomeworkTaskStatus }) =>
      apiFetch(`/api/v1/homework/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['homework', homeworkId, 'tasks'] });
      void queryClient.invalidateQueries({ queryKey: courseKey(courseId, 'homework') });
    },
  });
  return (
    <ul className="mt-2 grid gap-1 border-t border-line pt-2">
      {(tasks.data ?? []).map((task) => (
        <li key={task.id} className="flex items-center justify-between gap-2">
          <span>{task.memberName}</span>
          {writable ? (
            <Button
              variant={task.status === 'DONE' ? 'primary' : 'ghost'}
              className="min-h-9 px-3"
              onClick={() => mark.mutate({ id: task.id, status: task.status === 'DONE' ? 'ASSIGNED' : 'DONE' })}
            >
              {t(`homework.status.${task.status}`)}
            </Button>
          ) : (
            <Badge>{t(`homework.status.${task.status}`)}</Badge>
          )}
        </li>
      ))}
    </ul>
  );
}
