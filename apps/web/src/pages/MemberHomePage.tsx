import { useTranslation } from 'react-i18next';
import { useMe } from '../hooks/use-me';

export function MemberHomePage() {
  const { t } = useTranslation();
  const me = useMe();
  return (
    <section>
      <h1 className="text-2xl font-semibold">{t('member.homeTitle')}</h1>
      <p className="mt-2 text-sm text-slate-600">{me.data?.identity.phone}</p>
    </section>
  );
}
