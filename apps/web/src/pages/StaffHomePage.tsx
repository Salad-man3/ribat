import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MemberNameLink } from '../components/MemberNameLink';
import { NavButton } from '../components/ui/nav-button';
import type {
  CourseResponse,
  JoinApplicationResponse,
  StaffSessionsResponse,
  StaffTodayOverview,
} from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { useMembers } from '../api/members';
import { Button } from '../components/ui/button';
import { Card, PageHeader } from '../components/ui/form';
import { useActiveMembership } from '../hooks/use-me';
import {
  addDays,
  formatGregorianNumeric,
  formatTimeRange,
  lobbyWeekDates,
  today,
  weekBoundsSaturdayFirst,
} from '../lib/domain';
import { cn } from '../lib/utils';

export function StaffHomePage() {
  const { t, i18n } = useTranslation();
  const { membership, can } = useActiveMembership();
  const members = useMembers();
  const thisWeekStart = weekBoundsSaturdayFirst(today()).from;
  const [weekStart, setWeekStart] = useState(thisWeekStart);
  const from = weekStart;
  const to = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const sessions = useQuery({
    queryKey: ['staff-sessions', from, to],
    queryFn: () =>
      apiFetch<StaffSessionsResponse>(`/api/v1/sessions?from=${from}&to=${to}`),
    enabled: can('courses.manage'),
  });
  const courses = useQuery({
    queryKey: ['courses', 'CURRENT'],
    queryFn: () => apiFetch<CourseResponse[]>('/api/v1/courses'),
    enabled: can('courses.manage'),
  });
  const todayOverview = useQuery({
    queryKey: ['staff-today-overview'],
    queryFn: () => apiFetch<StaffTodayOverview>('/api/v1/staff/today-overview'),
    enabled: can('courses.manage'),
  });
  const pendingJoin = useQuery({
    queryKey: ['join-applications', 'PENDING'],
    queryFn: () =>
      apiFetch<JoinApplicationResponse[]>(
        '/api/v1/join-applications?status=PENDING',
      ),
    enabled: can('memberships.manage'),
  });

  const activeCourses =
    courses.data?.filter((c) => c.status === 'ACTIVE').length ?? undefined;
  const memberCount = members.data?.length;
  const dayToday = today();

  const byDay = new Map<string, StaffSessionsResponse['sessions']>();
  for (const s of sessions.data?.sessions ?? []) {
    const list = byDay.get(s.date) ?? [];
    list.push(s);
    byDay.set(s.date, list);
  }
  const weekDays = lobbyWeekDates(from);
  const onThisWeek = weekStart === thisWeekStart;

  return (
    <section className="grid gap-6">
      <PageHeader
        chrome
        title={t('staff.homeTitle')}
        subtitle={membership ? t(`roles.${membership.role}`) : undefined}
      />

      {can('courses.manage') ? (
        <Card title={t('staff.todayTitle')}>
          {todayOverview.isError ? (
            <p className="text-sm text-danger">{t('errors.INTERNAL_ERROR')}</p>
          ) : todayOverview.data ? (
            <div className="grid gap-4">
              <div>
                <p className="text-sm font-semibold">
                  {t('staff.todayAbsences', {
                    count: todayOverview.data.absenceCount,
                  })}
                </p>
                {todayOverview.data.absences.length ? (
                  <ul className="mt-2 grid gap-1 text-sm text-muted">
                    {todayOverview.data.absences.slice(0, 8).map((row, i) => (
                      <li key={`${row.memberId}-${i}`}>
                        <MemberNameLink memberId={row.memberId}>
                          {row.memberName}
                        </MemberNameLink>
                        {' · '}
                        {row.courseName}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-muted">
                    {t('staff.todayAbsencesEmpty')}
                  </p>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {t('staff.todayMemorization', {
                    count: todayOverview.data.memorizationLogCount,
                  })}
                </p>
                {todayOverview.data.memorizationLogs.length ? (
                  <ul className="mt-2 grid gap-1 text-sm text-muted">
                    {todayOverview.data.memorizationLogs
                      .slice(0, 8)
                      .map((row, i) => (
                        <li key={`${row.memberId}-${i}`}>
                          <MemberNameLink memberId={row.memberId}>
                            {row.memberName}
                          </MemberNameLink>
                          {t('staff.todayMemorizationSuffix', {
                            course: row.courseName,
                            from: row.pageFrom,
                            to: row.pageTo,
                          })}
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-muted">
                    {t('staff.todayMemorizationEmpty')}
                  </p>
                )}
              </div>
              {can('memberships.manage') &&
              (pendingJoin.data?.length ?? 0) > 0 ? (
                <NavButton
                  to="/staff/members/accounts"
                  className="min-h-11 rounded-xl bg-accent px-4 py-2 text-center text-sm font-semibold text-accent-ink"
                >
                  {t('staff.reviewJoinApplications', {
                    count: pendingJoin.data!.length,
                  })}
                </NavButton>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted">…</p>
          )}
        </Card>
      ) : null}

      {can('courses.manage') ? (
        <Card
          title={t('staff.weekSchedule')}
          actions={
            <div className="flex flex-wrap items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                className="min-h-8 px-2 text-xs"
                onClick={() => setWeekStart(addDays(weekStart, -7))}
              >
                {t('staff.weekPrev')}
              </Button>
              {!onThisWeek ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-8 px-2 text-xs font-semibold text-accent"
                  onClick={() => setWeekStart(thisWeekStart)}
                >
                  {t('staff.weekThis')}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                className="min-h-8 px-2 text-xs"
                onClick={() => setWeekStart(addDays(weekStart, 7))}
              >
                {t('staff.weekNext')}
              </Button>
              <NavButton
                to="/staff/placement"
                className="min-h-8 rounded-lg px-2 text-xs font-semibold text-accent"
              >
                {t('placement.title')}
              </NavButton>
            </div>
          }
        >
          <div className="md:overflow-x-auto">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:min-w-[44rem] md:grid-cols-7">
              {weekDays.map(({ weekday, date }) => {
                const items = (byDay.get(date) ?? [])
                  .slice()
                  .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
                const isToday = date === dayToday;
                return (
                  <div
                    key={date}
                    className={cn(
                      'flex flex-col rounded-xl border border-line bg-paper/40 p-2 md:min-h-[6rem] md:min-w-[6rem]',
                      isToday && 'ring-2 ring-accent/40',
                    )}
                  >
                    <header className="mb-2 flex items-baseline justify-between border-b border-line pb-1 md:block md:text-center">
                      <p className="text-xs font-semibold">
                        {t(`schedule.weekdays.${weekday}`)}
                      </p>
                      <p className="text-[10px] tabular-nums text-muted">
                        {formatGregorianNumeric(date)}
                      </p>
                    </header>
                    <ul className="grid flex-1 gap-1.5">
                      {items.length === 0 ? (
                        <li className="text-center text-[10px] text-muted">
                          {t('staff.weekDayEmpty')}
                        </li>
                      ) : (
                        items.map((s) => (
                          <li key={s.id}>
                            <NavButton
                              to={`/staff/courses/${s.courseId}`}
                              className="block w-full rounded-lg border border-line bg-surface p-2 text-start text-xs hover:border-accent"
                            >
                              <p className="break-words font-semibold leading-snug">
                                {s.courseName}
                              </p>
                              <p className="mt-0.5 text-[10px] text-muted">
                                {formatTimeRange(
                                  s.startsAt,
                                  s.endsAt,
                                  i18n.language,
                                )}
                              </p>
                              {s.leadTeacherName ? (
                                <p className="mt-0.5 text-[10px] text-muted md:truncate">
                                  {s.leadTeacherName}
                                </p>
                              ) : null}
                            </NavButton>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <StatChip label={t('staff.activeMembers')} value={memberCount} />
        {can('courses.manage') ? (
          <>
            <StatChip
              label={t('staff.activeTeachers')}
              value={sessions.data?.activeTeacherCount}
            />
            <StatChip label={t('staff.activeCourses')} value={activeCourses} />
            <StatChip
              label={t('staff.sessionsThisWeek')}
              value={sessions.data?.sessions.length}
            />
          </>
        ) : null}
      </div>
    </section>
  );
}

function StatChip({
  label,
  value,
}: {
  label: string;
  value: number | undefined;
}) {
  return (
    <div className="min-w-[8rem] flex-1 rounded-xl border border-line bg-surface px-3 py-2">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="text-xl font-semibold tabular-nums">
        {value === undefined ? '…' : value >= 200 ? '200+' : value}
      </p>
    </div>
  );
}
