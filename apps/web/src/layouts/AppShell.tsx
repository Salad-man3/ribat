import { NavLink, Outlet, useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ActiveView, MembershipRole, S1Permission } from '@ribat/shared';
import { logout, switchView } from '../api/auth';
import { Button } from '../components/ui/button';
import { Emblem } from '../components/Emblem';
import { ThemePicker } from '../components/ThemePicker';
import { useActiveMembership } from '../hooks/use-me';
import { useBackgroundSync } from '../offline/outbox';
import { useNotifications } from '../pages/NotificationsPage';
import { cn } from '../lib/utils';

type NavItem = { to: string; label: string };

/** Ghost buttons sitting on the green chrome. */
const onChrome =
  'border-white/20 bg-transparent text-chrome-ink hover:bg-white/10';

/** Which links a viewer sees. The API enforces the same rules; this only hides dead ends. */
function navFor(
  role: MembershipRole,
  activeView: ActiveView | null,
  can: (permission: S1Permission) => boolean,
): NavItem[] {
  if (role === 'GUARDIAN') return [{ to: '/guardian', label: 'nav.guardian' }];
  if (role === 'MEMBER' || activeView === 'MEMBER')
    return [
      { to: '/member', label: 'nav.member' },
      { to: '/teach', label: 'nav.teach' },
    ];
  return [
    { to: '/staff', label: 'nav.staff' },
    { to: '/teach', label: 'nav.teach' },
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
    ...(can('members.manage')
      ? [{ to: '/staff/excuses', label: 'nav.excuses' }]
      : []),
    ...(can('audit.read') ? [{ to: '/staff/audit', label: 'nav.audit' }] : []),
    ...(can('audit.read')
      ? [{ to: '/staff/events', label: 'nav.events' }]
      : []),
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
  useBackgroundSync();
  const unread = useNotifications().data?.unread ?? 0;
  // No membership (offline or still loading): class mode is the only link that works.
  const nav = membership
    ? [
        ...navFor(membership.role, activeView, can),
        { to: '/notifications', label: 'nav.notifications' },
        { to: '/account/devices', label: 'nav.devices' },
      ]
    : [{ to: '/teach', label: 'nav.teach' }];

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
      {item.to === '/notifications' && unread ? (
        <span className="ms-2 rounded-full bg-chrome-ink px-1.5 text-xs font-semibold text-chrome">
          {unread}
        </span>
      ) : null}
    </NavLink>
  ));

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <aside className="chrome-lattice hidden bg-chrome text-chrome-ink md:sticky md:top-0 md:flex md:h-dvh md:flex-col md:overflow-y-auto md:gap-6 md:p-4">
        <div aria-hidden className="frieze-y absolute inset-y-0 end-0" />
        <div className="flex items-center gap-3">
          <Emblem className="size-8" />
          <div>
            <p className="font-brand text-2xl font-semibold">{t('appName')}</p>
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
          <ThemePicker className={onChrome} />
          <Button
            variant="ghost"
            className={onChrome}
            onClick={() => signOut.mutate()}
          >
            {t('shell.signOut')}
          </Button>
        </div>
      </aside>

      <header className="chrome-lattice sticky top-0 z-10 bg-chrome text-chrome-ink md:hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <Emblem />
            <div className="min-w-0">
              <p className="font-brand text-lg font-semibold leading-tight">{t('appName')}</p>
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
            <ThemePicker className={cn(onChrome, 'px-2')} />
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
        <div aria-hidden className="frieze-x" />
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-10">
        <Outlet />
      </main>
    </div>
  );
}
