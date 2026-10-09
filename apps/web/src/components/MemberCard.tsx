import type { MemberResponse } from '@ribat/shared';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Badge } from './ui/form';

export function fullName(
  member: Pick<MemberResponse, 'firstName' | 'fatherName' | 'familyName'>,
) {
  return `${member.firstName} ${member.fatherName} ${member.familyName}`;
}

const FIELDS = [
  'phone',
  'birthDate',
  'motherName',
  'schoolGrade',
  'schoolName',
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
  const rows = FIELDS.filter(
    (key) => member[key] != null && member[key] !== '',
  );
  const title = <h2 className="text-lg font-semibold">{fullName(member)}</h2>;
  return (
    <article className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <header className="flex items-start justify-between gap-2">
        {to ? (
          <Link to={to} className="hover:text-accent">
            {title}
          </Link>
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
          {rows.map((key) => (
            <div key={key}>
              <dt className="text-xs text-muted">{t(`members.${key}`)}</dt>
              <dd
                dir={key === 'phone' ? 'ltr' : undefined}
                className="text-start"
              >
                {String(member[key])}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </article>
  );
}
