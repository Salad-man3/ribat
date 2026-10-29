import type { MemberResponse } from '@ribat/shared';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { NavButton } from './ui/nav-button';
import { Badge } from './ui/form';

export function fullName(
  member: Pick<MemberResponse, 'firstName' | 'fatherName' | 'familyName'>,
) {
  return `${member.firstName} ${member.fatherName} ${member.familyName}`;
}

/** One readable line per study status, or null while it is unknown. */
export function educationLine(member: MemberResponse, t: TFunction) {
  const parts: (string | null)[] =
    member.studyStatus === 'SCHOOL'
      ? [member.schoolGrade, member.schoolName]
      : member.studyStatus === 'UNIVERSITY'
        ? [
            t('members.universityStudent'),
            member.university,
            member.faculty,
            member.universityYear ? t(`members.year.${member.universityYear}`) : null,
          ]
        : member.studyStatus === 'NOT_STUDYING' && member.highestEducation
          ? [
              t('members.highestLine', {
                level: t(`members.educationLevel.${member.highestEducation}`),
              }),
              member.faculty,
            ]
          : [];
  return parts.filter(Boolean).join(' · ') || null;
}

const FIELDS = [
  'phone',
  'birthDate',
  'motherName',
  'address',
  'joinedAt',
  'notes',
] as const satisfies readonly (keyof MemberResponse)[];

/**
 * The API shapes members by the viewer's role, so a field can be missing.
 * The card shows whatever came back and nothing else.
 */
export function MemberCard({
  member,
  to,
}: {
  member: MemberResponse;
  to?: string;
}) {
  const { t } = useTranslation();
  const rows: [string, string][] = FIELDS.filter(
    (key) => member[key] != null && member[key] !== '',
  ).map((key) => [key, String(member[key])]);
  const education = educationLine(member, t);
  if (education) rows.splice(3, 0, ['education', education]);
  const title = <h2 className="text-lg font-semibold">{fullName(member)}</h2>;
  return (
    <article className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <header className="flex items-start justify-between gap-2">
        {to ? (
          <NavButton to={to} className="text-start hover:text-accent">
            {title}
          </NavButton>
        ) : (
          title
        )}
        {member.status ? (
          <Badge tone={member.status === 'ACTIVE' ? 'accent' : 'neutral'}>
            {t(`members.statusValue.${member.status}`)}
          </Badge>
        ) : null}
      </header>
      {rows.length ? (
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {rows.map(([key, value]) => (
            <div key={key}>
              <dt className="text-xs text-muted">{t(`members.${key}`)}</dt>
              <dd
                dir={key === 'phone' ? 'ltr' : undefined}
                className="text-start"
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </article>
  );
}
