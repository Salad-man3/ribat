import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { MemberResponse } from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { MemberCard } from '../components/MemberCard';
import { Empty, ErrorText, PageHeader } from '../components/ui/form';
import { useActiveMembership } from '../hooks/use-me';

export function GuardianHomePage() {
  const { t } = useTranslation();
  const { membership } = useActiveMembership();
  const wards = useQuery({
    queryKey: ['wards'],
    queryFn: () => apiFetch<MemberResponse[]>('/api/v1/wards'),
  });

  return (
    <section className="grid gap-6">
      <PageHeader
        title={t('guardian.homeTitle')}
        subtitle={membership?.organizationName}
      />
      {wards.isError ? <ErrorText error={wards.error} /> : null}
      {wards.data?.length === 0 ? <Empty>{t('guardian.empty')}</Empty> : null}
      <div className="grid gap-3">
        {(wards.data ?? []).map((member) => (
          <MemberCard key={member.id} member={member} />
        ))}
      </div>
    </section>
  );
}
