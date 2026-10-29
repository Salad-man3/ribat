import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { NavButton } from '../components/ui/nav-button';
import type { MyCourseResponse } from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { ProgressPanel, TodayTeachingCard, WeekTimetable } from '../components/family';
import { PublishedReportCards } from '../components/PublishedReportCards';
import { Badge, Card, PageHeader } from '../components/ui/form';
import { useActiveMembership } from '../hooks/use-me';

export function MemberHomePage() {
  const { t } = useTranslation();
  const { me, membership } = useActiveMembership();
  return (
    <section className="grid gap-6">
      <PageHeader chrome title={t('member.homeTitle')} />
      <TodayTeachingCard />
      <WeekTimetable />
      <TeachingCard />
      <Card title={t('member.account')}>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted">{t('members.phone')}</dt>
            <dd dir="ltr" className="text-start">
              {me.data?.identity.phone}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{t('roles.label')}</dt>
            <dd>{membership ? t(`roles.${membership.role}`) : '—'}</dd>
          </div>
        </dl>
      </Card>
      {membership?.memberId ? (
        <>
          <PublishedReportCards memberId={membership.memberId} basePath="/member" />
          <ProgressPanel memberId={membership.memberId} />
        </>
      ) : null}
    </section>
  );
}

/** PERM-03: teaching comes from assignments on courses, not from a role. Hidden when none. */
function TeachingCard() {
  const { t } = useTranslation();
  const courses = useQuery({
    queryKey: ['me', 'courses'],
    queryFn: () => apiFetch<MyCourseResponse[]>('/api/v1/me/courses'),
  });
  if (!courses.data?.length) return null;
  return (
    <Card title={t('member.teaching')}>
      <ul className="grid gap-2">
        {courses.data.map((course) => (
          <li key={course.id}>
            <NavButton
              to={`/member/courses/${course.id}`}
              className="flex w-full items-center justify-between gap-2 rounded-lg bg-paper px-3 py-2 text-start text-sm hover:text-accent"
            >
              <span className="font-medium">{course.name}</span>
              <span className="flex gap-2">
                <Badge tone="accent">
                  {t(`teachers.role.${course.teachingRole}`)}
                </Badge>
                <Badge>{t(`courses.status.${course.status}`)}</Badge>
              </span>
            </NavButton>
          </li>
        ))}
      </ul>
    </Card>
  );
}
