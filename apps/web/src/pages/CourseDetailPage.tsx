import { useQuery } from '@tanstack/react-query';
import type { MyCourseResponse, SessionResponse } from '@ribat/shared';
import { apiFetch, ApiError } from '../api/api-fetch';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { NavButton } from '../components/ui/nav-button';
import { courseKey, useCourse } from '../api/courses';
import { Badge, ErrorText, SectionNav } from '../components/ui/form';
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
import { NotFoundPage } from './NotFoundPage';

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
  const openSession = (todaySessions.data ?? []).find(
    (s) => s.status !== 'CANCELLED',
  );

  const sectionItems = [
    ...(staff
      ? [{ id: 'course-overview', label: t('courses.overview') }]
      : []),
    { id: 'course-wall', label: t('hifz.halaqaWallTitle') },
    { id: 'course-materials', label: t('materials.courseTitle') },
    { id: 'course-teachers', label: t('teachers.title') },
    { id: 'course-students', label: t('students.title') },
    ...(data.isHierarchical && data.hasGroups
      ? [{ id: 'course-groups', label: t('groups.title') }]
      : []),
    { id: 'course-schedule', label: t('schedule.title') },
    { id: 'course-homework', label: t('homework.title') },
  ];

  return (
    <section className="grid gap-6">
      <NavButton
        to={staff ? '/staff/courses' : '/member'}
        className="text-sm text-accent"
      >
        <span className="inline-block rtl:rotate-180">←</span>{' '}
        {staff ? t('courses.title') : t('nav.member')}
      </NavButton>
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

      {openSession && canOpenClass ? (
        <NavButton
          to={`/teach/${openSession.id}`}
          className="block w-full rounded-xl border border-accent bg-paper px-4 py-3 text-start text-sm font-semibold text-accent hover:bg-accent-soft"
        >
          {t('staff.openClass')} — {t('courses.todaySession')}
        </NavButton>
      ) : null}

      <SectionNav items={sectionItems} />

      {staff ? (
        <div id="course-overview" className="record-section">
          <OverviewSection {...ctx} />
        </div>
      ) : null}
      <div id="course-wall" className="record-section">
        <HalaqaWallSection {...ctx} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div id="course-materials" className="record-section">
          <MaterialsSection
            {...ctx}
            canEdit={writable && (staff ? can('materials.manage') : true)}
          />
        </div>
        <div id="course-teachers" className="record-section">
          <TeachersSection {...ctx} />
        </div>
      </div>
      <div id="course-students" className="record-section">
        <StudentsSection {...ctx} />
      </div>
      {data.isHierarchical && data.hasGroups ? (
        <div id="course-groups" className="record-section">
          <GroupsSection {...ctx} />
        </div>
      ) : null}
      <div id="course-schedule" className="record-section">
        <ScheduleSection {...ctx} />
      </div>
      <div id="course-homework" className="record-section">
        <HomeworkSection {...ctx} />
      </div>
    </section>
  );
}
