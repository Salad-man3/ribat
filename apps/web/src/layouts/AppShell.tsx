import { NavLink, Outlet, useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ActiveView, MembershipRole, S1Permission } from '@ribat/shared';
import { logout, switchView } from '../api/auth';
import { Button } from '../components/ui/button';
import { Emblem } from '../components/Emblem';
import { useActiveMembership } from '../hooks/use-me';
import { cn } from '../lib/utils';

type NavItem = { to: string; label: string };

/** Ghost buttons sitting on the green chrome. */
const onChrome =
  'border-white/20 bg-transparent text-chrome-ink hover:bg-white/10';

/** Which links a viewer sees. The API enforces the same rules; this only hides dead ends. */
function navFor(
  role: MembershipRole | undefined,
  activeView: ActiveView | null,
  can: (permission: S1Permission) => boolean,
): NavItem[] {
  if (role === 'GUARDIAN') return [{ to: '/guardian', label: 'nav.guardian' }];
  if (role === 'MEMBER' || activeView === 'MEMBER')
    return [{ to: '/member', label: 'nav.member' }];
  return [
    { to: '/staff', label: 'nav.staff' },
    ...(can('members.manage')
      ? [{ to: '/staff/members', label: 'nav.members' }]
      : []),
    ...(can('courses.manage')
      ? [{ to: '/staff/courses', label: 'nav.courses' }]
      : []),
    ...(can('materials.manage')
      ? [{ to: '/staff/materials', label: 'nav.materials' }]
      : []),
    ...(can('memberships.manage')
      ? [{ to: '/staff/roles', label: 'nav.roles' }]
      : []),
    ...(can('audit.read') ? [{ to: '/staff/audit', label: 'nav.audit' }] : []),
    ...(can('organization.manage')
      ? [{ to: '/staff/organization', label: 'nav.organization' }]
      : []),
  ];
}

export function AppShell() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { me, membership, activeView, can } = useActiveMembership();
  const nav = [
    ...navFor(membership?.role, activeView, can),
    { to: '/account/devices', label: 'nav.devices' },
  ];

  const toggleView = useMutation({
    mutationFn: () => switchView(activeView === 'MEMBER' ? 'ADMIN' : 'MEMBER'),
    onSuccess: (data) => {
      queryClient.setQueryData(['me'], data);
      void queryClient.invalidateQueries();
      navigate('/', { replace: true });
    },
  });
  const signOut = useMutation({
    mutationFn: logout,
    onSettled: () => {
      queryClient.clear();
      navigate('/login', { replace: true });
    },
  });

  const languageToggle = (
    <Button
      variant="ghost"
      className={onChrome}
      onClick={() =>
        void i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar')
      }
    >
      {i18n.language === 'ar' ? t('switchToEnglish') : t('switchToArabic')}
    </Button>
  );

  const links = nav.map((item) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.to === '/staff'}
      className={({ isActive }) =>
        cn(
          'shrink-0 rounded-lg border-s-2 px-3 py-2 text-sm font-medium transition',
          isActive
            ? 'border-gold bg-white/10 text-chrome-ink'
            : 'border-transparent text-chrome-muted hover:bg-white/5 hover:text-chrome-ink',
        )
      }
    >
      {t(item.label)}
    </NavLink>
  ));

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <aside className="hidden bg-chrome text-chrome-ink md:sticky md:top-0 md:flex md:h-dvh md:flex-col md:overflow-y-auto md:gap-6 md:p-4">
        <div className="flex items-center gap-3">
          <Emblem className="size-8" />
          <div>
            <p className="text-xl font-semibold">{t('appName')}</p>
            <p className="mt-0.5 text-sm text-chrome-muted">
              {membership?.organizationName}
            </p>
          </div>
        </div>
        <nav className="grid gap-1">{links}</nav>
        <div className="mt-auto grid gap-2">
          {membership ? (
            <p className="text-xs text-chrome-muted">
              {me.data?.identity.phone} · {t(`roles.${membership.role}`)}
            </p>
          ) : null}
          {activeView ? (
            <Button
              variant="ghost"
              className={onChrome}
              onClick={() => toggleView.mutate()}
              disabled={toggleView.isPending}
            >
              {activeView === 'ADMIN'
                ? t('shell.switchToMember')
                : t('shell.switchToAdmin')}
            </Button>
          ) : null}
          {languageToggle}
          <Button
            variant="ghost"
            className={onChrome}
            onClick={() => signOut.mutate()}
          >
            {t('shell.signOut')}
          </Button>
        </div>
      </aside>

      <header className="sticky top-0 z-10 bg-chrome text-chrome-ink md:hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <Emblem />
            <div className="min-w-0">
              <p className="font-semibold">{t('appName')}</p>
              <p className="truncate text-xs text-chrome-muted">
                {membership?.organizationName}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            {activeView ? (
              <Button
                variant="ghost"
                className={cn(onChrome, 'px-2')}
                onClick={() => toggleView.mutate()}
                disabled={toggleView.isPending}
              >
                {activeView === 'ADMIN'
                  ? t('shell.memberViewShort')
                  : t('shell.adminViewShort')}
              </Button>
            ) : null}
            {languageToggle}
            <Button
              variant="ghost"
              className={cn(onChrome, 'px-2')}
              onClick={() => signOut.mutate()}
            >
              {t('shell.signOut')}
            </Button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">{links}</nav>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-10">
        <Outlet />
      </main>
    </div>
  );
}
