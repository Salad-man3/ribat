import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { switchView } from '../api/auth';
import { Button } from '../components/ui/button';
import { useMe } from '../hooks/use-me';

export function StaffHomePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const me = useMe();
  const toggle = useMutation({
    mutationFn: () =>
      switchView(me.data?.activeView === 'MEMBER' ? 'ADMIN' : 'MEMBER'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });

  return (
    <section className="grid gap-4">
      <h1 className="text-2xl font-semibold">{t('staff.homeTitle')}</h1>
      <p className="text-sm text-slate-600">
        {t('staff.activeView')}: {me.data?.activeView ?? '—'}
      </p>
      {me.data?.activeView ? (
        <Button type="button" variant="ghost" onClick={() => toggle.mutate()} disabled={toggle.isPending}>
          {me.data.activeView === 'ADMIN' ? t('staff.switchToMember') : t('staff.switchToAdmin')}
        </Button>
      ) : null}
    </section>
  );
}
