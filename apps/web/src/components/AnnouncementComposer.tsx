import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  AnnouncementTargetType,
  CourseResponse,
  GroupResponse,
  MemberResponse,
  MembershipRole,
  OrganizationResponse,
  ProgramResponse,
  TagResponse,
} from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { useMembers } from '../api/members';
import { fullName } from './MemberCard';
import { Button } from './ui/button';
import { Card, ErrorText, Field, inputClass } from './ui/form';
import { useActiveMembership } from '../hooks/use-me';
import { notificationsKey } from '../pages/NotificationsPage';

const STAFF_TARGETS: AnnouncementTargetType[] = [
  'EVERYONE',
  'PROGRAMS',
  'COURSES',
  'GROUPS',
  'MEMBERS',
  'ROLES',
  'TAGS',
];

const TEACHER_TARGETS: AnnouncementTargetType[] = ['COURSES', 'GROUPS', 'MEMBERS'];

const MEMBERSHIP_ROLES: MembershipRole[] = [
  'SHEIKH',
  'ORG_ADMIN',
  'MEMBER',
  'GUARDIAN',
];

export function AnnouncementComposer() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { can, activeView } = useActiveMembership();
  const isStaff = can('courses.manage') && activeView === 'ADMIN';

  const org = useQuery({
    queryKey: ['organization'],
    queryFn: () => apiFetch<OrganizationResponse>('/api/v1/organization'),
  });

  const myCourses = useQuery({
    queryKey: ['me', 'courses'],
    queryFn: () => apiFetch<CourseResponse[]>('/api/v1/me/courses'),
    enabled: !isStaff,
  });

  const allCourses = useQuery({
    queryKey: ['courses', 'CURRENT'],
    queryFn: () => apiFetch<CourseResponse[]>('/api/v1/courses'),
    enabled: isStaff,
  });

  const programs = useQuery({
    queryKey: ['programs'],
    queryFn: () => apiFetch<ProgramResponse[]>('/api/v1/programs'),
    enabled: isStaff,
  });

  const courses = isStaff ? (allCourses.data ?? []) : (myCourses.data ?? []);

  const [courseForGroups, setCourseForGroups] = useState('');
  const groups = useQuery({
    queryKey: ['courses', courseForGroups, 'groups'],
    queryFn: () =>
      apiFetch<GroupResponse[]>(`/api/v1/courses/${courseForGroups}/groups`),
    enabled: !!courseForGroups,
  });

  const members = useMembers();
  const tags = useQuery({
    queryKey: ['tags'],
    queryFn: () => apiFetch<TagResponse[]>('/api/v1/tags'),
    enabled: isStaff && org.data?.tagsEnabled === true,
  });

  const allowedTargets = useMemo(() => {
    if (isStaff) {
      return STAFF_TARGETS.filter(
        (target) => target !== 'TAGS' || org.data?.tagsEnabled,
      );
    }
    return TEACHER_TARGETS;
  }, [isStaff, org.data?.tagsEnabled]);

  const [targetType, setTargetType] = useState<AnnouncementTargetType>(
    allowedTargets[0] ?? 'COURSES',
  );
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const toggle = (id: string) =>
    setTargetIds((current) =>
      current.includes(id) ? current.filter((v) => v !== id) : [...current, id],
    );

  const send = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/announcements', {
        method: 'POST',
        body: JSON.stringify({
          title,
          body,
          targetType,
          targetIds: targetType === 'EVERYONE' ? [] : targetIds,
        }),
      }),
    onSuccess: async () => {
      setTitle('');
      setBody('');
      setTargetIds([]);
      await queryClient.invalidateQueries({ queryKey: notificationsKey });
    },
  });

  if (!isStaff && courses.length === 0) return null;

  const memberOptions = (members.data ?? []).filter((m) => m.status === 'ACTIVE');

  return (
    <Card title={t('announcements.composeTitle')}>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          send.mutate();
        }}
      >
        <Field label={t('announcements.targetType')}>
          <select
            className={inputClass}
            value={targetType}
            onChange={(e) => {
              setTargetType(e.target.value as AnnouncementTargetType);
              setTargetIds([]);
              setCourseForGroups('');
            }}
          >
            {allowedTargets.map((value) => (
              <option key={value} value={value}>
                {t(`announcements.targets.${value}`)}
              </option>
            ))}
          </select>
        </Field>

        {targetType === 'PROGRAMS' ? (
          <Field label={t('announcements.pickPrograms')}>
            <ul className="grid max-h-40 gap-1 overflow-y-auto rounded-xl border border-line p-2">
              {(programs.data ?? []).map((program) => (
                <li key={program.id}>
                  <label className="flex cursor-pointer items-center gap-2 px-2 py-1 text-sm">
                    <input
                      type="checkbox"
                      className="accent-accent"
                      checked={targetIds.includes(program.id)}
                      onChange={() => toggle(program.id)}
                    />
                    {program.name}
                  </label>
                </li>
              ))}
            </ul>
          </Field>
        ) : null}

        {targetType === 'COURSES' ? (
          <Field label={t('announcements.pickCourses')}>
            <ul className="grid max-h-40 gap-1 overflow-y-auto rounded-xl border border-line p-2">
              {courses.map((course) => (
                <li key={course.id}>
                  <label className="flex cursor-pointer items-center gap-2 px-2 py-1 text-sm">
                    <input
                      type="checkbox"
                      className="accent-accent"
                      checked={targetIds.includes(course.id)}
                      onChange={() => toggle(course.id)}
                    />
                    {course.name}
                  </label>
                </li>
              ))}
            </ul>
          </Field>
        ) : null}

        {targetType === 'GROUPS' ? (
          <>
            <Field label={t('announcements.pickCourseForGroups')}>
              <select
                className={inputClass}
                value={courseForGroups}
                onChange={(e) => {
                  setCourseForGroups(e.target.value);
                  setTargetIds([]);
                }}
                required
              >
                <option value="" />
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
            </Field>
            {courseForGroups ? (
              <Field label={t('announcements.pickGroups')}>
                <ul className="grid max-h-40 gap-1 overflow-y-auto rounded-xl border border-line p-2">
                  {(groups.data ?? []).map((group) => (
                    <li key={group.id}>
                      <label className="flex cursor-pointer items-center gap-2 px-2 py-1 text-sm">
                        <input
                          type="checkbox"
                          className="accent-accent"
                          checked={targetIds.includes(group.id)}
                          onChange={() => toggle(group.id)}
                        />
                        {group.name}
                      </label>
                    </li>
                  ))}
                </ul>
              </Field>
            ) : null}
          </>
        ) : null}

        {targetType === 'MEMBERS' ? (
          <Field label={t('announcements.pickMembers')}>
            <ul className="grid max-h-48 gap-1 overflow-y-auto rounded-xl border border-line p-2">
              {memberOptions.map((member: MemberResponse) => (
                <li key={member.id}>
                  <label className="flex cursor-pointer items-center gap-2 px-2 py-1 text-sm">
                    <input
                      type="checkbox"
                      className="accent-accent"
                      checked={targetIds.includes(member.id)}
                      onChange={() => toggle(member.id)}
                    />
                    {fullName(member)}
                  </label>
                </li>
              ))}
            </ul>
          </Field>
        ) : null}

        {targetType === 'ROLES' ? (
          <Field label={t('announcements.pickRoles')}>
            <ul className="grid gap-1 rounded-xl border border-line p-2">
              {MEMBERSHIP_ROLES.map((role) => (
                <li key={role}>
                  <label className="flex cursor-pointer items-center gap-2 px-2 py-1 text-sm">
                    <input
                      type="checkbox"
                      className="accent-accent"
                      checked={targetIds.includes(role)}
                      onChange={() => toggle(role)}
                    />
                    {t(`roles.${role}`)}
                  </label>
                </li>
              ))}
            </ul>
          </Field>
        ) : null}

        {targetType === 'TAGS' ? (
          <Field label={t('announcements.pickTags')}>
            <ul className="grid max-h-40 gap-1 overflow-y-auto rounded-xl border border-line p-2">
              {(tags.data ?? []).map((tag) => (
                <li key={tag.id}>
                  <label className="flex cursor-pointer items-center gap-2 px-2 py-1 text-sm">
                    <input
                      type="checkbox"
                      className="accent-accent"
                      checked={targetIds.includes(tag.id)}
                      onChange={() => toggle(tag.id)}
                    />
                    {tag.name}
                  </label>
                </li>
              ))}
            </ul>
          </Field>
        ) : null}

        <Field label={t('announcements.title')}>
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
          />
        </Field>
        <Field label={t('announcements.body')}>
          <textarea
            className={inputClass}
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            maxLength={4000}
          />
        </Field>
        <Button
          type="submit"
          disabled={
            send.isPending ||
            (targetType !== 'EVERYONE' && targetIds.length === 0)
          }
        >
          {t('announcements.send')}
        </Button>
        {send.isError ? <ErrorText error={send.error} /> : null}
      </form>
    </Card>
  );
}
