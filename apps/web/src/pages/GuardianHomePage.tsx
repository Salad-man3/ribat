import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MemberResponse } from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { ExcuseForm, ProgressPanel, WeekTimetable } from '../components/family';
import { PublishedReportCards } from '../components/PublishedReportCards';
import { MemberCard } from '../components/MemberCard';
import { NavButton } from '../components/ui/nav-button';
import { Badge, Card, Empty, ErrorText, Field, PageHeader, inputClass } from '../components/ui/form';
import { useNotifications } from './NotificationsPage';

export function GuardianHomePage() {
  const { t } = useTranslation();
  const wards = useQuery({
    queryKey: ['wards'],
    queryFn: () => apiFetch<MemberResponse[]>('/api/v1/wards'),
  });
  const unread = useNotifications(null).data?.unread ?? 0;
  const [excuseMemberId, setExcuseMemberId] = useState<string | null>(null);
  const excuseTarget =
    excuseMemberId ?? wards.data?.[0]?.id ?? null;

  return (
    <section className="grid gap-6">
      <PageHeader chrome title={t('guardian.homeTitle')} />
      {wards.isError ? <ErrorText error={wards.error} /> : null}
      {wards.data?.length === 0 ? <Empty>{t('guardian.empty')}</Empty> : null}
      {wards.data?.length ? (
        <>
          <Card title={t('guardian.quickActions')}>
            <div className="grid gap-3 sm:grid-cols-2">
              <NavButton
                to="/notifications"
                className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-line bg-paper px-4 py-3 text-start font-semibold hover:border-accent"
              >
                {t('guardian.openNotifications')}
                {unread ? (
                  <Badge tone="accent">{t('guardian.unreadNotifications', { count: unread })}</Badge>
                ) : null}
              </NavButton>
            </div>
          </Card>
          <Card title={t('guardian.submitExcuse')}>
            {wards.data.length > 1 ? (
              <Field label={t('guardian.excuseFor')}>
                <select
                  className={inputClass}
                  value={excuseTarget ?? ''}
                  onChange={(e) => setExcuseMemberId(e.target.value)}
                >
                  {wards.data.map((m) => (
                    <option key={m.id} value={m.id}>
                      {[m.firstName, m.fatherName, m.familyName].filter(Boolean).join(' ')}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            {excuseTarget ? <ExcuseForm memberId={excuseTarget} /> : null}
          </Card>
          <WeekTimetable />
        </>
      ) : null}
      {(wards.data ?? []).map((member) => (
        <section key={member.id} className="grid gap-3">
          <MemberCard member={member} />
          <PublishedReportCards memberId={member.id} basePath="/guardian" />
          <ProgressPanel memberId={member.id} showExcuse={false} />
        </section>
      ))}
    </section>
  );
}
