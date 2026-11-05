import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import type { MemberProgressResponse } from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { ProgressPanel } from '../components/family';
import { MemberHalaqatOverview } from '../components/MemberHalaqatOverview';
import { BackLink, ErrorText, PageHeader } from '../components/ui/form';

export function GuardianMemberPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const progress = useQuery({
    queryKey: ['progress', id],
    queryFn: () =>
      apiFetch<MemberProgressResponse>(`/api/v1/members/${id}/progress`),
    retry: false,
  });

  if (progress.isError) return <ErrorText error={progress.error} />;
  const name = progress.data?.memberName;

  return (
    <section className="grid gap-6">
      <BackLink to="/guardian">{t('guardian.homeTitle')}</BackLink>
      <PageHeader chrome title={name ?? '…'} />
      <MemberHalaqatOverview memberId={id} />
      <ProgressPanel memberId={id} showExcuse={false} />
    </section>
  );
}
