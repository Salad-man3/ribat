import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { MyCourseResponse, SessionResponse } from '@ribat/shared';
import { apiFetch, ApiError } from '../api/api-fetch';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router';
import { courseKey, useCourse } from '../api/courses';
import { BackLink, Badge, ErrorText, Segmented } from '../components/ui/form';
import { useActiveMembership } from '../hooks/use-me';
import { isWritable, today } from '../lib/domain';
import { statusTone } from './CoursesPage';
import { GroupsSection } from './course/GroupsSection';
import { HomeworkSection } from './course/HomeworkSection';
import { MaterialsSection } from './course/MaterialsSection';
import { OverviewSection } from './course/OverviewSection';
import { StudentsSection, TeachersSection } from './course/PeopleSections';
import { HalaqaWallSection } from './course/HalaqaWallSection';
import { ScheduleSection } from './course/ScheduleSection';
import { CourseTodayCard } from './course/CourseTodayCard';
import { CourseSessionsSection } from './course/CourseSessionsSection';
import { NotFoundPage } from './NotFoundPage';

type CourseTab = 'overview' | 'wall' | 'people' | 'plan' | 'sessions';

/**
 * One page for staff (/staff/courses/:id) and for the course's teachers (/member/courses/:id).
 * Teachers read everything here and may change materials (OQ-3); the API enforces the same.
 */
export function CourseDetailPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const { can } = useActiveMembership();
  const course = useCourse(id);
  const staff = can('courses.manage');
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const initialTab: CourseTab =
    tabFromUrl === 'overview' ||
    tabFromUrl === 'wall' ||
    tabFromUrl === 'people' ||
    tabFromUrl === 'plan' ||
    tabFromUrl === 'sessions'
      ? tabFromUrl
      : staff
        ? 'people'
        : 'wall';
  const [tab, setTab] = useState<CourseTab>(initialTab);
  const setCourseTab = (next: CourseTab) => {
    setTab(next);
    setSearchParams({ tab: next }, { replace: true });
  };
  const myCourses = useQuery({
    queryKey: ['me', 'courses'],
    queryFn: () => apiFetch<MyCourseResponse[]>('/api/v1/me/courses'),
    enabled: !staff,
  });
  const teachesHere = (myCourses.data ?? []).some((c) => c.id === id);
  const canOpenClass = staff || teachesHere;
  const day = today();
  const todaySessions = useQuery({
    queryKey: courseKey(id, 'sessions', day),
    queryFn: () =>
      apiFetch<SessionResponse[]>(
        `/api/v1/courses/${id}/sessions?from=${day}&to=${day}`,
      ),
    enabled: Boolean(id),
  });

  if (
    course.error instanceof ApiError &&
    course.error.body.error.code === 'NOT_FOUND'
  )
    return <NotFoundPage />;
  if (course.isError) return <ErrorText error={course.error} />;
  if (!course.data) return <p className="text-sm text-muted">…</p>;

  const data = course.data;
  const writable = isWritable(data.status);
  const ctx = { course: data, staff, writable, canOpenClass };
  const tabOptions: { value: CourseTab; label: string }[] = [
    ...(staff
      ? [{ value: 'overview' as const, label: t('courses.overview') }]
      : []),
    { value: 'wall', label: t('hifz.halaqaWallTitle') },
    { value: 'people', label: t('courses.tabPeople') },
    { value: 'sessions', label: t('courses.tabSessions') },
    { value: 'plan', label: t('courses.tabPlan') },
  ];

  return (
    <section className="grid gap-6">
      <BackLink to={staff ? '/staff/courses' : '/member'}>
        {staff ? t('courses.title') : t('nav.member')}
      </BackLink>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {data.name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {t(`courses.type.${data.type}`)}
          </p>
        </div>
        <Badge tone={statusTone(data.status)}>
          {t(`courses.status.${data.status}`)}
        </Badge>
      </header>
      {!writable ? (
        <p className="rounded-lg bg-paper px-3 py-2 text-sm text-muted">
          {t('courses.readOnly')}
        </p>
      ) : null}

      <CourseTodayCard
        {...ctx}
        todaySessions={todaySessions.data}
        sessionsLoading={todaySessions.isLoading}
      />

      <Segmented
        value={tab}
        onChange={setCourseTab}
        aria-label={data.name}
        options={tabOptions}
      />

      {tab === 'overview' && staff ? <OverviewSection {...ctx} /> : null}
      {tab === 'wall' ? <HalaqaWallSection {...ctx} /> : null}
      {tab === 'people' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <MaterialsSection
            {...ctx}
            canEdit={writable && (staff ? can('materials.manage') : true)}
          />
          <TeachersSection {...ctx} />
          <div className="lg:col-span-2">
            <StudentsSection {...ctx} />
          </div>
          {data.isHierarchical && data.hasGroups ? (
            <div className="lg:col-span-2">
              <GroupsSection {...ctx} />
            </div>
          ) : null}
        </div>
      ) : null}
      {tab === 'sessions' ? <CourseSessionsSection {...ctx} /> : null}
      {tab === 'plan' ? (
        <div className="grid gap-6">
          <ScheduleSection {...ctx} />
          <HomeworkSection {...ctx} />
        </div>
      ) : null}
    </section>
  );
}
