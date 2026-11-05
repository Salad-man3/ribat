import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import type {
  CreateDoroosInput,
  DoroosListItem,
  SessionConflict,
} from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { useMembers } from '../api/members';
import { fullName } from '../components/MemberCard';
import { Button } from '../components/ui/button';
import {
  Card,
  Empty,
  ErrorText,
  Field,
  PageHeader,
  inputClass,
} from '../components/ui/form';
import { addDays, formatTimeRange, today } from '../lib/domain';
import { useFormatDates } from '../lib/calendar';

export function DoroosPage() {
  const { t, i18n } = useTranslation();
  const { formatDate } = useFormatDates();
  const from = addDays(today(), -14);
  const to = addDays(today(), 14);
  const list = useQuery({
    queryKey: ['doroos', from, to],
    queryFn: () =>
      apiFetch<DoroosListItem[]>(`/api/v1/doroos?from=${from}&to=${to}`),
  });

  return (
    <section className="grid gap-6">
      <PageHeader
        chrome
        title={t('doroos.title')}
        subtitle={t('doroos.subtitle')}
      />
      <CreateDoroosForm />
      <Card title={t('doroos.listTitle')}>
        {list.isError ? <ErrorText error={list.error} /> : null}
        {list.isLoading ? <p className="text-sm text-muted">…</p> : null}
        {!list.data?.length ? <Empty>{t('doroos.empty')}</Empty> : null}
        <ul className="grid gap-2 text-sm">
          {list.data?.map((d) => (
            <li key={d.id}>
              <Link
                to={`/staff/doroos/${d.courseId}`}
                className="flex flex-wrap justify-between gap-2 rounded-lg bg-paper px-3 py-2 hover:text-accent"
              >
                <span className="font-medium">{d.courseName}</span>
                <span className="text-muted">
                  {formatDate(d.date)} ·{' '}
                  {formatTimeRange(d.startsAt, d.endsAt, i18n.language)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

function CreateDoroosForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const members = useMembers();
  const teachers = members.data ?? [];
  const [open, setOpen] = useState(false);
  const [conflicts, setConflicts] = useState<SessionConflict[]>([]);
  const [form, setForm] = useState({
    name: '',
    type: 'MEMORIZATION' as CreateDoroosInput['type'],
    date: today(),
    startTime: '16:00',
    endTime: '17:00',
    teacherMemberId: '',
    memberIds: '' as string,
  });

  const save = useMutation({
    mutationFn: async () => {
      const teacherMemberIds = form.teacherMemberId
        ? [form.teacherMemberId]
        : teachers[0]?.id
          ? [teachers[0].id]
          : [];
      const memberIds = form.memberIds
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const body: CreateDoroosInput = {
        name: form.name,
        type: form.type,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        teacherMemberIds,
        memberIds,
        courseIds: [],
      };
      const preview = await apiFetch<SessionConflict[]>(
        '/api/v1/sessions/conflicts',
        {
          method: 'POST',
          body: JSON.stringify({
            memberIds: [...memberIds, ...teacherMemberIds],
            windows: [
              {
                startsAt: new Date(
                  `${form.date}T${form.startTime}:00`,
                ).toISOString(),
                endsAt: new Date(
                  `${form.date}T${form.endTime}:00`,
                ).toISOString(),
              },
            ],
          }),
        },
      );
      setConflicts(preview);
      return apiFetch<{ courseId: string }>('/api/v1/doroos', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: async (res) => {
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ['doroos'] });
      navigate(`/staff/doroos/${res.courseId}`);
    },
  });

  if (!open) {
    return <Button onClick={() => setOpen(true)}>{t('doroos.create')}</Button>;
  }

  return (
    <Card title={t('doroos.create')}>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Field label={t('courses.name')}>
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </Field>
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label={t('sessions.from')}>
            <input
              type="date"
              className={inputClass}
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </Field>
          <Field label={t('schedule.from')}>
            <input
              type="time"
              className={inputClass}
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            />
          </Field>
          <Field label={t('schedule.to')}>
            <input
              type="time"
              className={inputClass}
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            />
          </Field>
        </div>
        <Field label={t('doroos.teacher')}>
          <select
            className={inputClass}
            value={form.teacherMemberId}
            onChange={(e) =>
              setForm({ ...form, teacherMemberId: e.target.value })
            }
          >
            <option value="">{t('doroos.pickTeacher')}</option>
            {teachers.map((m) => (
              <option key={m.id} value={m.id}>
                {fullName(m)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('doroos.memberIdsHint')}>
          <input
            className={inputClass}
            value={form.memberIds}
            onChange={(e) => setForm({ ...form, memberIds: e.target.value })}
            placeholder={t('doroos.memberIdsPlaceholder')}
          />
        </Field>
        {conflicts.length ? (
          <p className="text-sm text-gold">
            {t('doroos.conflicts', { count: conflicts.length })}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={save.isPending}>
            {t('common.save')}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            {t('classMode.cancel')}
          </Button>
        </div>
        {save.isError ? <ErrorText error={save.error} /> : null}
      </form>
    </Card>
  );
}
