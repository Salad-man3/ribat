import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import type { SessionResponse } from '@ribat/shared';
import { ApiError, apiFetch } from '../../api/api-fetch';
import { courseKey } from '../../api/courses';
import { useOrgPrayerTimes } from '../../components/TimePointEditor';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/form';
import { NavButton } from '../../components/ui/nav-button';
import { useFormatDates } from '../../lib/calendar';
import { formatTimeRange, today } from '../../lib/domain';
import type { SectionProps } from './types';

function wallTimesInZone(timeZone: string, durationMin: number) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  const startTime = `${pad(h)}:${pad(m)}`;
  const total = h * 60 + m + durationMin;
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  const endTime = `${pad(eh)}:${pad(em)}`;
  return { date: today(), startTime, endTime };
}

export function CourseTodayCard({
  course,
  canOpenClass,
  writable,
  todaySessions,
  sessionsLoading,
}: SectionProps & {
  todaySessions: SessionResponse[] | undefined;
  sessionsLoading: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { formatDate } = useFormatDates();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const orgTimes = useOrgPrayerTimes();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const openSession = (todaySessions ?? []).find(
    (s) => s.status !== 'CANCELLED',
  );
  const day = today();
  const timeZone = orgTimes.data?.timezone;

  const startDars = useMutation({
    mutationFn: async () => {
      const tz = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
      const { date, startTime, endTime } = wallTimesInZone(tz, 60);
      return apiFetch<SessionResponse>(
        `/api/v1/courses/${course.id}/sessions`,
        {
          method: 'POST',
          body: JSON.stringify({ date, startTime, endTime }),
        },
      );
    },
    onSuccess: (session) => {
      setConfirmOpen(false);
      dialogRef.current?.close();
      void queryClient.invalidateQueries({
        queryKey: courseKey(course.id, 'sessions'),
      });
      navigate(`/teach/${session.id}`);
    },
    onError: async (err) => {
      if (err instanceof ApiError && err.status === 409) {
        await queryClient.invalidateQueries({
          queryKey: courseKey(course.id, 'sessions', day),
        });
        const fresh = await queryClient.fetchQuery({
          queryKey: courseKey(course.id, 'sessions', day),
          queryFn: () =>
            apiFetch<SessionResponse[]>(
              `/api/v1/courses/${course.id}/sessions?from=${day}&to=${day}`,
            ),
        });
        const existing = fresh.find((s) => s.status !== 'CANCELLED');
        if (existing) {
          setConfirmOpen(false);
          dialogRef.current?.close();
          navigate(`/teach/${existing.id}`);
        }
      }
    },
  });

  if (!canOpenClass) return null;

  const openConfirm = () => {
    setConfirmOpen(true);
    dialogRef.current?.showModal();
  };

  const closeConfirm = () => {
    setConfirmOpen(false);
    dialogRef.current?.close();
  };

  return (
    <>
      <Card title={t('courses.todayTitle')}>
        {sessionsLoading ? (
          <p className="text-sm text-muted">…</p>
        ) : openSession ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {formatDate(openSession.date)} ·{' '}
              {formatTimeRange(
                openSession.startsAt,
                openSession.endsAt,
                i18n.language,
                timeZone,
              )}
            </p>
            <NavButton
              to={`/teach/${openSession.id}`}
              className="min-h-11 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-strong"
            >
              {t('staff.openClass')}
            </NavButton>
          </div>
        ) : writable ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">{t('courses.noSessionToday')}</p>
            <Button
              type="button"
              variant="ghost"
              className="text-sm font-semibold text-accent"
              onClick={openConfirm}
            >
              {t('courses.startDars')}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted">{t('courses.noSessionToday')}</p>
        )}
      </Card>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="max-w-md rounded-2xl border border-line bg-surface p-0 shadow-lg backdrop:bg-ink/40"
        onClose={() => setConfirmOpen(false)}
      >
        {confirmOpen ? (
          <form
            className="grid gap-4 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              startDars.mutate();
            }}
          >
            <h2 id={titleId} className="text-lg font-semibold">
              {t('courses.startDarsConfirmTitle')}
            </h2>
            <p className="text-sm text-muted">
              {t('courses.startDarsConfirmBody', { name: course.name })}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={closeConfirm}>
                {t('classMode.cancel')}
              </Button>
              <Button type="submit" disabled={startDars.isPending}>
                {t('courses.startDarsConfirmAction')}
              </Button>
            </div>
          </form>
        ) : null}
      </dialog>
    </>
  );
}
