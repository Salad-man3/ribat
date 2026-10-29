import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { NavButton } from '../components/ui/nav-button';
import type {
  CourseResponse,
  JoinApplicationResponse,
  StaffSessionsResponse,
  StaffTodayOverview,
} from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { useMembers } from '../api/members';
import { Card, PageHeader } from '../components/ui/form';
import { useActiveMembership } from '../hooks/use-me';
import {
  formatGregorianNumeric,
  formatTimeRange,
  lobbyWeekDates,
  today,
  weekBoundsSaturdayFirst,
} from '../lib/domain';

export function StaffHomePage() {
  const { t, i18n } = useTranslation();
  const { membership, can } = useActiveMembership();
  const members = useMembers();
  const { from, to } = weekBoundsSaturdayFirst(today());
  const sessions = useQuery({
    queryKey: ['staff-sessions', from, to],
    queryFn: () =>
      apiFetch<StaffSessionsResponse>(
        `/api/v1/sessions?from=${from}&to=${to}`,
      ),
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

  const links = [
    {
      to: '/staff/members',
      label: 'nav.members',
      hint: 'staff.membersHint',
      perm: 'members.manage',
    },
    {
      to: '/staff/courses',
      label: 'nav.courses',
      hint: 'staff.coursesHint',
      perm: 'courses.manage',
    },
    {
      to: '/staff/materials',
      label: 'nav.materials',
      hint: 'staff.materialsHint',
      perm: 'materials.manage',
    },
    {
      to: '/staff/roles',
      label: 'nav.roles',
      hint: 'staff.rolesHint',
      perm: 'memberships.manage',
    },
    {
      to: '/staff/audit',
      label: 'nav.audit',
      hint: 'staff.auditHint',
      perm: 'audit.read',
    },
    {
      to: '/staff/organization',
      label: 'nav.organization',
      hint: 'staff.organizationHint',
      perm: 'organization.manage',
    },
  ] as const;

  const byDay = new Map<string, StaffSessionsResponse['sessions']>();
  for (const s of sessions.data?.sessions ?? []) {
    const list = byDay.get(s.date) ?? [];
    list.push(s);
    byDay.set(s.date, list);
  }
  const weekDays = lobbyWeekDates(from);

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
                  {t('staff.todayAbsences', { count: todayOverview.data.absenceCount })}
                </p>
                {todayOverview.data.absences.length ? (
                  <ul className="mt-2 grid gap-1 text-sm text-muted">
                    {todayOverview.data.absences.slice(0, 8).map((row, i) => (
                      <li key={`${row.memberName}-${i}`}>
                        {t('staff.todayAbsenceLine', {
                          name: row.memberName,
                          course: row.courseName,
                        })}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-muted">{t('staff.todayAbsencesEmpty')}</p>
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
                    {todayOverview.data.memorizationLogs.slice(0, 8).map((row, i) => (
                      <li key={`${row.memberName}-${i}`}>
                        {t('staff.todayMemorizationLine', {
                          name: row.memberName,
                          course: row.courseName,
                          from: row.pageFrom,
                          to: row.pageTo,
                        })}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-muted">{t('staff.todayMemorizationEmpty')}</p>
                )}
              </div>
              {can('memberships.manage') && (pendingJoin.data?.length ?? 0) > 0 ? (
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
        <Card title={t('staff.weekSchedule')}>
          <ul className="grid gap-4">
            {weekDays.map(({ weekday, date }) => {
              const items = byDay.get(date) ?? [];
              return (
                <li
                  key={date}
                  className="rounded-xl border border-line bg-paper/40 p-3"
                >
                  <h3 className="text-sm font-semibold">
                    {t(`schedule.weekdays.${weekday}`)}
                    <span className="ms-2 text-xs font-normal text-muted">
                      {formatGregorianNumeric(date)}
                    </span>
                  </h3>
                  {items.length === 0 ? (
                    <p className="mt-2 text-xs text-muted">
                      {t('staff.weekDayEmpty')}
                    </p>
                  ) : (
                    <ul className="mt-2 divide-y divide-line">
                      {items.map((s) => (
                        <li
                          key={s.id}
                          className="flex flex-wrap items-center justify-between gap-2 py-2"
                        >
                          <div>
                            <p className="font-medium">{s.courseName}</p>
                            <p className="text-xs text-muted">
                              {formatTimeRange(
                                s.startsAt,
                                s.endsAt,
                                i18n.language,
                              )}
                              {s.leadTeacherName
                                ? ` · ${s.leadTeacherName}`
                                : ''}
                            </p>
                          </div>
                          <NavButton
                            to={`/teach/${s.id}`}
                            className="text-sm font-semibold text-accent"
                          >
                            {t('staff.openClass')}
                          </NavButton>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
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

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          {t('staff.quickAccess')}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {links
            .filter((link) => can(link.perm))
            .map((link) => (
              <NavButton
                key={link.to}
                to={link.to}
                className="rounded-xl border border-line bg-surface px-4 py-3 text-start transition hover:border-accent"
              >
                <p className="text-sm font-semibold">{t(link.label)}</p>
                <p className="mt-0.5 text-xs text-muted">{t(link.hint)}</p>
              </NavButton>
            ))}
        </div>
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
