import { Outlet, NavLink } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { useMe } from '../hooks/use-me';

export function AppShell() {
  const { t, i18n } = useTranslation();
  const me = useMe();
  const role = me.data?.memberships.find(
    (membership) => membership.organizationId === me.data?.activeOrganizationId,
  )?.role;

  const nav =
    role === 'GUARDIAN'
      ? [{ to: '/guardian', label: t('nav.guardian') }]
      : role === 'MEMBER'
        ? [{ to: '/member', label: t('nav.member') }]
        : [
            { to: '/staff', label: t('nav.staff') },
            { to: '/staff/members', label: t('nav.members') },
            { to: '/account/devices', label: t('nav.devices') },
          ];

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="text-lg font-semibold">{t('appName')}</p>
            <p className="text-sm text-slate-600">{t('tagline')}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => void i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar')}
          >
            {i18n.language === 'ar' ? t('switchToEnglish') : t('switchToArabic')}
          </Button>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 pb-3">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'rounded-full px-3 py-1.5 text-sm',
                  isActive ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
