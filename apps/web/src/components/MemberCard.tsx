import type { MemberResponse } from '@ribat/shared';
import { useTranslation } from 'react-i18next';

type Props = {
  member: MemberResponse;
};

export function MemberCard({ member }: Props) {
  const { t } = useTranslation();
  const name = `${member.firstName} ${member.fatherName} ${member.familyName}`;
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-medium">{name}</h2>
      <dl className="mt-2 grid gap-1 text-sm text-slate-600">
        <div>
          <dt className="inline">{t('members.status')}: </dt>
          <dd className="inline">{member.status}</dd>
        </div>
        {member.phone ? (
          <div>
            <dt className="inline">{t('members.phone')}: </dt>
            <dd className="inline">{member.phone}</dd>
          </div>
        ) : null}
        {member.notes ? (
          <div>
            <dt className="inline">{t('members.notes')}: </dt>
            <dd className="inline">{member.notes}</dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}
