import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type {
  ReportCardResponse,
  StatsDashboardResponse,
  StatsTeacherResponse,
} from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { MemberCombobox } from '../components/MemberCombobox';
import { StatCard } from '../components/StatCard';
import { Badge, Card, Empty, ErrorText, Field, PageHeader, inputClass } from '../components/ui/form';
import { Button } from '../components/ui/button';
import { useActiveMembership } from '../hooks/use-me';
import { formatGregorianNumeric } from '../lib/domain';

function formatRate(rate: number | null | undefined, locale: string): string {
  if (rate === null || rate === undefined) return '—';
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(rate);
}

export function ReportsPage() {
  const { t, i18n } = useTranslation();
  const { can, membership } = useActiveMembership();
  const memberId = membership?.memberId;
  const isStaff = can('courses.manage');

  const dashboard = useQuery({
    queryKey: ['stats-dashboard'],
    queryFn: () => apiFetch<StatsDashboardResponse>('/api/v1/stats/dashboard'),
    enabled: isStaff,
  });

  const teacher = useQuery({
    queryKey: ['stats-teacher', memberId],
    queryFn: () => apiFetch<StatsTeacherResponse>(`/api/v1/stats/teachers/${memberId}`),
    enabled: !isStaff && !!memberId,
  });

  const cards = useQuery({
    queryKey: ['report-cards'],
    queryFn: () => apiFetch<ReportCardResponse[]>('/api/v1/report-cards'),
    enabled: isStaff || !!memberId,
  });

  const loading = isStaff ? dashboard.isLoading : teacher.isLoading;
  const error = isStaff ? dashboard.error : teacher.error;

  return (
    <section className="grid gap-6">
      <PageHeader
        chrome
        title={t('stats.title')}
        subtitle={t('stats.staleHint')}
      />

      {loading ? <p className="text-sm text-muted">…</p> : null}
      {error ? <ErrorText error={error} /> : null}

      {isStaff && dashboard.data ? (
        <StaffReports data={dashboard.data} locale={i18n.language} />
      ) : null}

      {!isStaff && teacher.data ? (
        <TeacherReports data={teacher.data} locale={i18n.language} />
      ) : null}

      {!isStaff && !memberId && !loading ? (
        <Empty>{t('stats.noTeacherData')}</Empty>
      ) : null}

      {(isStaff || memberId) && cards.data ? (
        <ReportCardsPanel cards={cards.data} staff={isStaff} />
      ) : null}
    </section>
  );
}

function StaffReports({ data, locale }: { data: StatsDashboardResponse; locale: string }) {
  const { t } = useTranslation();
  const m = data.mosque;
  const rate = formatRate(
    m.attendancePresent + m.attendanceLate + m.attendanceAbsent > 0
      ? (m.attendancePresent + m.attendanceLate) /
          (m.attendancePresent + m.attendanceLate + m.attendanceAbsent)
      : null,
    locale,
  );

  const byProgram = useMemo(() => {
    const groups = new Map<string | null, typeof data.courses>();
    for (const c of data.courses) {
      const key = c.programName ?? t('stats.noProgram');
      const list = groups.get(key) ?? [];
      list.push(c);
      groups.set(key, list);
    }
    return [...groups.entries()];
  }, [data.courses, t]);

  return (
    <>
      <p className="text-xs text-muted">
        {t('stats.asOf', {
          date: formatGregorianNumeric(data.asOf),
          from: formatGregorianNumeric(data.from),
          to: formatGregorianNumeric(data.to),
        })}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('stats.activeMembers')} value={m.activeMembers} />
        <StatCard label={t('stats.activeCourses')} value={m.activeCourses} />
        <StatCard label={t('stats.activeTeachers')} value={m.activeTeachers} />
        <StatCard label={t('stats.pendingApplications')} value={m.pendingJoinApplications} />
        <StatCard label={t('stats.attendanceRate')} value={rate} />
        <StatCard label={t('stats.pagesThisWeek')} value={m.pagesMemorized} />
        <StatCard label={t('stats.testsPassed')} value={m.testsPassed} />
      </div>

      <Card title={t('stats.byHalaqa')}>
        {data.courses.length === 0 ? (
          <Empty>{t('stats.noCourseData')}</Empty>
        ) : (
          <ul className="grid gap-4">
            {byProgram.map(([program, courses]) => (
              <li key={program}>
                <h3 className="text-sm font-semibold text-muted">{program}</h3>
                <ul className="mt-2 divide-y divide-line">
                  {courses.map((c) => (
                    <li key={c.courseId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <Link to={`/staff/courses/${c.courseId}`} className="font-medium hover:text-accent">
                        {c.courseName}
                      </Link>
                      <div className="flex flex-wrap gap-2 text-xs text-muted">
                        <span>{t('stats.attendanceRate')}: {formatRate(c.attendanceRate, locale)}</span>
                        <span>{t('stats.pagesShort', { count: c.pagesMemorized })}</span>
                        {c.sessionsMissingAttendance > 0 ? (
                          <Badge tone="danger">{t('stats.missingAttendance', { count: c.sessionsMissingAttendance })}</Badge>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={t('stats.attention')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold">{t('stats.teachersNotLogging')}</h3>
            <ul className="mt-2 text-sm">
              {data.teachers.filter((x) => !x.loggedThisWeek).length === 0 ? (
                <li className="text-muted">{t('stats.allTeachersLogged')}</li>
              ) : (
                data.teachers
                  .filter((x) => !x.loggedThisWeek)
                  .map((x) => (
                    <li key={x.teacherMemberId}>{x.teacherName}</li>
                  ))
              )}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold">{t('stats.fallingBehind')}</h3>
            <ul className="mt-2 text-sm">
              {data.fallingBehind.length === 0 ? (
                <li className="text-muted">{t('stats.noFallingBehind')}</li>
              ) : (
                data.fallingBehind.map((x) => (
                  <li key={x.memberId}>
                    <Link to={`/staff/members/${x.memberId}`} className="hover:text-accent">
                      {x.memberName}
                    </Link>
                    {' · '}
                    {formatRate(x.attendanceRate, locale)}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </Card>

      {data.topMembers.length > 0 ? (
        <Card title={t('stats.topMemorizers')}>
          <ol className="list-decimal ps-5 text-sm">
            {data.topMembers.map((x) => (
              <li key={x.memberId}>
                <Link to={`/staff/members/${x.memberId}`} className="hover:text-accent">
                  {x.memberName}
                </Link>
                {' — '}
                {t('stats.pagesShort', { count: x.pagesMemorized })}
              </li>
            ))}
          </ol>
        </Card>
      ) : null}
    </>
  );
}

function TeacherReports({ data, locale }: { data: StatsTeacherResponse; locale: string }) {
  const { t } = useTranslation();
  const totals = data.totals;
  const rate = formatRate(
    totals.attendancePresent + totals.attendanceLate + totals.attendanceAbsent > 0
      ? (totals.attendancePresent + totals.attendanceLate) /
          (totals.attendancePresent + totals.attendanceLate + totals.attendanceAbsent)
      : null,
    locale,
  );

  return (
    <>
      <p className="text-xs text-muted">
        {t('stats.asOf', {
          date: formatGregorianNumeric(data.asOf),
          from: formatGregorianNumeric(data.from),
          to: formatGregorianNumeric(data.to),
        })}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label={t('stats.attendanceRate')} value={rate} />
        <StatCard label={t('stats.pagesThisWeek')} value={totals.pagesMemorized} />
        <StatCard label={t('stats.loggedDays')} value={data.loggedDays} />
      </div>
      <Card title={t('stats.myHalaqas')}>
        <ul className="divide-y divide-line">
          {data.courses.map((c) => (
            <li key={c.courseId} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
              <span className="font-medium">{c.courseName}</span>
              <span className="text-muted">
                {formatRate(c.attendanceRate, locale)} · {t('stats.pagesShort', { count: c.pagesMemorized })}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

function ReportCardsPanel({ cards, staff }: { cards: ReportCardResponse[]; staff: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [memberId, setMemberId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  const create = useMutation({
    mutationFn: () =>
      apiFetch<ReportCardResponse>('/api/v1/report-cards', {
        method: 'POST',
        body: JSON.stringify({ memberId, periodStart, periodEnd }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['report-cards'] });
      setMemberId('');
      setPeriodStart('');
      setPeriodEnd('');
    },
  });

  const drafts = cards.filter((c) => c.status === 'DRAFT');
  const published = cards.filter((c) => c.status === 'PUBLISHED');

  return (
    <Card title={t('reportCards.title')}>
      {staff ? (
        <form
          className="mb-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <Field label={t('reportCards.member')}>
            <MemberCombobox value={memberId} onChange={setMemberId} />
          </Field>
          <Field label={t('reportCards.periodStart')}>
            <input type="date" className={inputClass} value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required />
          </Field>
          <Field label={t('reportCards.periodEnd')}>
            <input type="date" className={inputClass} value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required />
          </Field>
          <div className="flex items-end">
            <Button type="submit" disabled={create.isPending || !memberId}>
              {t('reportCards.draft')}
            </Button>
          </div>
          {create.isError ? <ErrorText error={create.error} /> : null}
        </form>
      ) : null}

      <div className="grid gap-4">
        {drafts.length > 0 ? (
          <ReportCardList items={drafts} label={t('reportCards.drafts')} staff={staff} />
        ) : null}
        {published.length > 0 ? (
          <ReportCardList items={published} label={t('reportCards.published')} staff={staff} />
        ) : null}
        {cards.length === 0 ? <Empty>{t('reportCards.empty')}</Empty> : null}
      </div>
    </Card>
  );
}

function ReportCardList({
  items,
  label,
  staff,
}: {
  items: ReportCardResponse[];
  label: string;
  staff: boolean;
}) {
  const { t } = useTranslation();
  const base = staff ? '/staff/reports/cards' : '/member/reports/cards';
  return (
    <div>
      <h3 className="text-sm font-semibold">{label}</h3>
      <ul className="mt-2 divide-y divide-line">
        {items.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <Link to={`${base}/${c.id}`} className="font-medium hover:text-accent">
              {c.memberName}
              {c.courseName ? ` · ${c.courseName}` : ''}
            </Link>
            <span className="text-xs text-muted">
              {c.periodStart} – {c.periodEnd}
              {c.status === 'DRAFT' ? ` · ${t('reportCards.statusDraft')}` : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
