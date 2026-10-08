import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { MemberResponse } from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { MemberCard } from '../components/MemberCard';

export function GuardianHomePage() {
  const { t } = useTranslation();
  const wards = useQuery({
    queryKey: ['wards'],
    queryFn: () => apiFetch<MemberResponse[]>('/api/v1/wards'),
  });

  return (
    <section className="grid gap-4">
      <h1 className="text-2xl font-semibold">{t('guardian.homeTitle')}</h1>
      <div className="grid gap-3">
        {(wards.data ?? []).map((member) => (
          <MemberCard key={member.id} member={member} />
        ))}
      </div>
    </section>
  );
}
