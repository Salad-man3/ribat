import { useTranslation } from 'react-i18next';
import { ProgressPanel } from '../components/family';
import { MemberHalaqatOverview } from '../components/MemberHalaqatOverview';
import { PublishedReportCards } from '../components/PublishedReportCards';
import { Card, PageHeader } from '../components/ui/form';
import { useActiveMembership } from '../hooks/use-me';

export function MemberProfilePage() {
  const { t } = useTranslation();
  const { me, membership } = useActiveMembership();
  return (
    <section className="grid gap-6">
      <PageHeader chrome title={t('member.profileTitle')} />
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
          <MemberHalaqatOverview memberId={membership.memberId} />
          <PublishedReportCards
            memberId={membership.memberId}
            basePath="/member"
          />
          <ProgressPanel memberId={membership.memberId} />
        </>
      ) : null}
    </section>
  );
}
