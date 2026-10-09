import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { ApiError } from '../api/api-fetch';
import { useCourse } from '../api/courses';
import { Badge, ErrorText } from '../components/ui/form';
import { useActiveMembership } from '../hooks/use-me';
import { isWritable } from '../lib/domain';
import { statusTone } from './CoursesPage';
import { GroupsSection } from './course/GroupsSection';
import { MaterialsSection } from './course/MaterialsSection';
import { OverviewSection } from './course/OverviewSection';
import { StudentsSection, TeachersSection } from './course/PeopleSections';
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

  if (
    course.error instanceof ApiError &&
    course.error.body.error.code === 'NOT_FOUND'
  )
    return <NotFoundPage />;
  if (course.isError) return <ErrorText error={course.error} />;
  if (!course.data) return <p className="text-sm text-muted">…</p>;

  const data = course.data;
  const staff = can('courses.manage');
  const writable = isWritable(data.status);
  const ctx = { course: data, staff, writable };

  return (
    <section className="grid gap-6">
      <Link
        to={staff ? '/staff/courses' : '/member'}
        className="text-sm text-accent"
      >
        <span className="inline-block rtl:rotate-180">←</span>{' '}
        {staff ? t('courses.title') : t('nav.member')}
      </Link>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{data.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {t(`courses.type.${data.type}`)}
            {data.location ? ` · ${data.location}` : ''}
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

      {staff ? <OverviewSection {...ctx} /> : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <MaterialsSection
          {...ctx}
          canEdit={writable && (staff ? can('materials.manage') : true)}
        />
        <TeachersSection {...ctx} />
      </div>
      <StudentsSection {...ctx} />
      {data.isHierarchical && data.hasGroups ? (
        <GroupsSection {...ctx} />
      ) : null}
      <ScheduleSection {...ctx} />
    </section>
  );
}
