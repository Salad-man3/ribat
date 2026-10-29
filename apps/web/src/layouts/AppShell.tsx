import { Outlet, useLocation, useNavigate } from 'react-router';
import { NavButton } from '../components/ui/nav-button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { logout, switchView } from '../api/auth';
import { Emblem } from '../components/Emblem';
import { useActiveMembership } from '../hooks/use-me';
import { useBackgroundSync } from '../offline/outbox';
import { useNotifications } from '../pages/NotificationsPage';
import { cn } from '../lib/utils';
import {
  navFor,
  phoneTabsFromNav,
  splitNavEntries,
  type NavEntry,
} from './app-nav';
import { PhoneChrome } from './PhoneChrome';
import { ShellAccount } from './ShellAccount';

const navLinkClass = (isActive: boolean, quiet?: boolean) =>
  cn(
    'shrink-0 rounded-lg border-s-2 px-3 py-2 font-medium transition',
    quiet ? 'text-[13px]' : 'text-sm',
    isActive
      ? 'border-gold bg-white/10 text-chrome-ink'
      : 'border-transparent text-chrome-muted hover:bg-white/5 hover:text-chrome-ink',
  );

function NavEntries({
  entries,
  unread,
  membersExpanded,
  setMembersExpanded,
  pathname,
  quiet,
  onNavigate,
}: {
  entries: NavEntry[];
  unread: number;
  membersExpanded: boolean;
  setMembersExpanded: (open: boolean) => void;
  pathname: string;
  quiet?: boolean;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();
  return entries.map((entry) => {
    if (entry.kind === 'link') {
      return (
        <NavButton
          key={entry.to}
          to={entry.to}
          end={entry.to === '/staff'}
          onClick={onNavigate}
          className="shrink-0 text-start"
          activeClassName={navLinkClass(true, quiet)}
          inactiveClassName={navLinkClass(false, quiet)}
        >
          {t(entry.label)}
          {entry.to === '/notifications' && unread ? (
            <span className="ms-2 rounded-full bg-chrome-ink px-1.5 text-xs font-semibold text-chrome">
              {unread}
            </span>
          ) : null}
        </NavButton>
      );
    }

    const underMembers = pathname.startsWith(entry.matchPrefix);
    const open = membersExpanded || underMembers;
    const groupActive = underMembers;

    return (
      <div key={entry.matchPrefix} className="grid w-full gap-1">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setMembersExpanded(!open)}
          className={cn(
            navLinkClass(groupActive, quiet),
            'flex w-full items-center justify-between text-start',
          )}
        >
          <span>{t(entry.label)}</span>
          <span className="text-xs opacity-70" aria-hidden>
            {open ? '▾' : '▸'}
          </span>
        </button>
        {open ? (
          <div
            role="group"
            className="ms-3 grid gap-0.5 rounded-lg border border-white/25 bg-white/5 p-1"
          >
            {entry.children.map((child) => (
              <NavButton
                key={child.to}
                to={child.to}
                end={child.end}
                onClick={onNavigate}
                className="text-start text-[13px]"
                activeClassName={navLinkClass(true, true)}
                inactiveClassName={navLinkClass(false, true)}
              >
                {t(child.label)}
              </NavButton>
            ))}
          </div>
        ) : null}
      </div>
    );
  });
}

function SidebarNav({
  primary,
  more,
  utility,
  unread,
  membersExpanded,
  setMembersExpanded,
  pathname,
}: {
  primary: NavEntry[];
  more: NavEntry[];
  utility: NavEntry[];
  unread: number;
  membersExpanded: boolean;
  setMembersExpanded: (open: boolean) => void;
  pathname: string;
}) {
  const { t } = useTranslation();
  const props = {
    unread,
    membersExpanded,
    setMembersExpanded,
    pathname,
  };
  return (
    <nav className="grid gap-1">
      <NavEntries entries={primary} {...props} />
      {more.length ? (
        <div className="mt-3 grid gap-1">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wide text-chrome-muted/90">
            {t('nav.more')}
          </p>
          <NavEntries entries={more} quiet {...props} />
        </div>
      ) : null}
      {utility.length ? (
        <div className="mt-3 grid gap-1 border-t border-white/15 pt-3">
          <NavEntries entries={utility} {...props} />
        </div>
      ) : null}
    </nav>
  );
}

export function AppShell() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { me, membership, activeView, can } = useActiveMembership();
  useBackgroundSync();
  const unread = useNotifications(null).data?.unread ?? 0;
  const [membersExpanded, setMembersExpanded] = useState(
    location.pathname.startsWith('/staff/members'),
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    if (location.pathname.startsWith('/staff/members')) setMembersExpanded(true);
  }, [location.pathname]);

  const roleNav: NavEntry[] = membership
    ? navFor(membership.role, activeView, can)
    : [{ kind: 'link', to: '/teach', label: 'nav.teach' }];

  const { primary, more } = splitNavEntries(roleNav);

  const utilityNav: NavEntry[] = membership
    ? [
        { kind: 'link', to: '/notifications', label: 'nav.notifications' },
        { kind: 'link', to: '/account/devices', label: 'nav.devices' },
      ]
    : [];

  const nav: NavEntry[] = [...roleNav, ...utilityNav];

  const phoneTabs = phoneTabsFromNav(roleNav);

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

  const account = (
    <ShellAccount
      variant="sidebar"
      phone={me.data?.identity.phone}
      role={membership?.role}
      activeView={activeView}
      onToggleView={() => toggleView.mutate()}
      togglePending={toggleView.isPending}
      onSignOut={() => signOut.mutate()}
      onLanguage={() =>
        void i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar')
      }
    />
  );

  const drawerAccount = (
    <ShellAccount
      variant="drawer"
      phone={me.data?.identity.phone}
      role={membership?.role}
      activeView={activeView}
      onToggleView={() => toggleView.mutate()}
      togglePending={toggleView.isPending}
      onSignOut={() => signOut.mutate()}
      onLanguage={() =>
        void i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar')
      }
    />
  );

  const navBlock = {
    primary,
    more,
    utility: utilityNav,
    unread,
    membersExpanded,
    setMembersExpanded,
    pathname: location.pathname,
  };

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <aside className="chrome-lattice relative hidden bg-chrome text-chrome-ink md:sticky md:top-0 md:flex md:h-dvh md:flex-col md:overflow-y-auto md:gap-6 md:p-4">
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
        <SidebarNav {...navBlock} />
        <div className="mt-auto">{account}</div>
      </aside>

      <PhoneChrome
        nav={nav}
        navBlock={navBlock}
        tabs={phoneTabs}
        unread={unread}
        drawerOpen={drawerOpen}
        setDrawerOpen={setDrawerOpen}
        drawerAccount={drawerAccount}
      />

      <main
        className={cn(
          'w-full px-4 py-6 md:px-8 md:py-10',
          phoneTabs.length
            ? 'max-md:pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))]'
            : 'max-md:pb-6',
        )}
      >
        <Outlet />
      </main>
    </div>
  );
}
