import { useLocation } from 'react-router';
import { NavButton } from '../components/ui/nav-button';
import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Emblem } from '../components/Emblem';
import { cn } from '../lib/utils';
import type { NavEntry, PhoneTab } from './app-nav';
import { isPhoneTabActive, mobileScreenTitleKey } from './app-nav';

const iconClass = 'size-6 shrink-0';

/** In-flow spacer height; must match the fixed phone header below. */
export const phoneTopBarSpacerStyle = {
  height:
    'calc(max(0.5rem, env(safe-area-inset-top, 0px)) + 2.75rem + 0.5rem + 1px)',
} as const;

function IconMenu() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} aria-hidden>
      <path
        fill="currentColor"
        d="M4 7h16v1.5H4V7zm0 5h16v1.5H4V12zm0 5h16v1.5H4V17z"
      />
    </svg>
  );
}

function IconBell() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} aria-hidden>
      <path
        fill="currentColor"
        d="M12 2a5 5 0 0 0-5 5v2.1c0 .5-.2 1-.5 1.4L5.1 13.5A1.5 1.5 0 0 0 6.4 16h11.2a1.5 1.5 0 0 0 1.3-2.5l-1.4-2.9a2 2 0 0 1-.5-1.4V7a5 5 0 0 0-5-5zm0 20a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22z"
      />
    </svg>
  );
}

function IconLobby() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} aria-hidden>
      <path
        fill="currentColor"
        d="M12 3 3 10.5V20h6v-6h6v6h6v-9.5L12 3z"
      />
    </svg>
  );
}

function IconPeople() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} aria-hidden>
      <path
        fill="currentColor"
        d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
      />
    </svg>
  );
}

function IconBook() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} aria-hidden>
      <path
        fill="currentColor"
        d="M18 2H8a2 2 0 0 0-2 2v16l6-3 6 3V4a2 2 0 0 0-2-2z"
      />
    </svg>
  );
}

function IconChart() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} aria-hidden>
      <path
        fill="currentColor"
        d="M5 20V10h3v10H5zm5.5 0V4h3v16h-3zM16 20v-7h3v7h-3z"
      />
    </svg>
  );
}

function IconFolder() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} aria-hidden>
      <path
        fill="currentColor"
        d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"
      />
    </svg>
  );
}

function IconPortal() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} aria-hidden>
      <path
        fill="currentColor"
        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-3.31 0-6 1.79-6 4v2h12v-2c0-2.21-2.69-4-6-4z"
      />
    </svg>
  );
}

function IconTeach() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} aria-hidden>
      <path
        fill="currentColor"
        d="M12 3 1 9l11 6 9-4.91V17h2V9L12 3zm0 12.5L4.5 10.5 12 6.5l7.5 4-7.5 5zM4 19v2h16v-2H4z"
      />
    </svg>
  );
}

function tabIcon(tab: PhoneTab) {
  switch (tab.matchPrefix) {
    case '/staff':
      return <IconLobby />;
    case '/staff/members':
      return <IconPeople />;
    case '/staff/courses':
      return <IconBook />;
    case '/staff/reports':
    case '/teach/reports':
      return <IconChart />;
    case '/staff/materials':
      return <IconFolder />;
    case '/member':
    case '/guardian':
      return <IconPortal />;
    case '/teach':
      return <IconTeach />;
    default:
      return <IconLobby />;
  }
}

const navLinkClass = (isActive: boolean, quiet?: boolean) =>
  cn(
    'rounded-lg border-s-2 px-3 py-2 font-medium transition',
    quiet ? 'text-[13px]' : 'text-sm',
    isActive
      ? 'border-gold bg-white/10 text-chrome-ink'
      : 'border-transparent text-chrome-muted hover:bg-white/5 hover:text-chrome-ink',
  );

type NavBlock = {
  primary: NavEntry[];
  more: NavEntry[];
  utility: NavEntry[];
  unread: number;
  membersExpanded: boolean;
  setMembersExpanded: (open: boolean) => void;
  pathname: string;
};

function DrawerNavEntries({
  block,
  onNavigate,
}: {
  block: NavBlock;
  onNavigate: () => void;
}) {
  const { t } = useTranslation();

  const renderEntries = (entries: NavEntry[], quiet?: boolean) =>
    entries.map((entry) => {
      if (entry.kind === 'link') {
        return (
          <NavButton
            key={entry.to}
            to={entry.to}
            end={entry.to === '/staff'}
            onClick={onNavigate}
            className="text-start"
            activeClassName={navLinkClass(true, quiet)}
            inactiveClassName={navLinkClass(false, quiet)}
          >
            {t(entry.label)}
            {entry.to === '/notifications' && block.unread ? (
              <span className="ms-2 rounded-full bg-chrome-ink px-1.5 text-xs font-semibold text-chrome">
                {block.unread}
              </span>
            ) : null}
          </NavButton>
        );
      }

      const underMembers = block.pathname.startsWith(entry.matchPrefix);
      const open = block.membersExpanded || underMembers;
      const groupActive = underMembers;

      return (
        <div key={entry.matchPrefix} className="grid w-full gap-1">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => block.setMembersExpanded(!open)}
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

  return (
    <nav className="grid gap-1">
      {renderEntries(block.primary)}
      {block.more.length ? (
        <div className="mt-3 grid gap-1">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wide text-chrome-muted/90">
            {t('nav.more')}
          </p>
          {renderEntries(block.more, true)}
        </div>
      ) : null}
      {block.utility.length ? (
        <div className="mt-3 grid gap-1 border-t border-white/15 pt-3">
          {renderEntries(block.utility)}
        </div>
      ) : null}
    </nav>
  );
}

export function PhoneChrome({
  nav,
  navBlock,
  tabs,
  unread,
  drawerOpen,
  setDrawerOpen,
  drawerAccount,
}: {
  nav: NavEntry[];
  navBlock: NavBlock;
  tabs: PhoneTab[];
  unread: number;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  drawerAccount: ReactNode;
}) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const titleKey = mobileScreenTitleKey(pathname, nav);
  const title = titleKey ? t(titleKey) : t('appName');

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname, setDrawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen, setDrawerOpen]);

  return (
    <>
      <div
        className="md:hidden"
        style={phoneTopBarSpacerStyle}
        aria-hidden
      />
      <header
        className="fixed inset-x-0 top-0 z-40 border-b border-line bg-paper text-ink md:hidden"
        style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
      >
        <div className="flex min-h-11 items-center gap-2 px-3 pb-2">
          <button
            type="button"
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-ink hover:bg-accent-soft"
            aria-expanded={drawerOpen}
            aria-label={t('shell.openMenu')}
            onClick={() => setDrawerOpen(true)}
          >
            <IconMenu />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-base font-semibold">
            {title}
          </h1>
          <NavButton
            to="/notifications"
            className="relative flex size-11 shrink-0 items-center justify-center rounded-lg text-ink hover:bg-accent-soft"
            aria-label={t('nav.notifications')}
          >
            <IconBell />
            {unread ? (
              <span className="absolute end-1.5 top-1.5 flex min-w-4 justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-ink">
                {unread > 99 ? '99+' : unread}
              </span>
            ) : null}
          </NavButton>
        </div>
      </header>

      {tabs.length ? (
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface md:hidden"
          style={{ paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))' }}
          aria-label={t('shell.mainTabs')}
        >
          <ul className="flex">
            {tabs.map((tab) => {
              const active = isPhoneTabActive(pathname, tab);
              return (
                <li key={tab.to} className="min-w-0 flex-1">
                  <NavButton
                    to={tab.to}
                    end={tab.end}
                    onClick={(e) => {
                      if (active) e.preventDefault();
                    }}
                    className={cn(
                      'flex min-h-11 w-full flex-col items-center justify-center gap-0.5 px-1 py-1 text-xs font-medium leading-tight',
                      active ? 'text-accent' : 'text-muted',
                    )}
                  >
                    {tabIcon(tab)}
                    <span className="max-w-full truncate">{t(tab.labelKey)}</span>
                  </NavButton>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/40"
            aria-label={t('shell.closeMenu')}
            onClick={() => setDrawerOpen(false)}
          />
          <aside
            className="chrome-lattice absolute inset-y-0 start-0 flex w-[min(18rem,88vw)] flex-col gap-6 overflow-y-auto bg-chrome p-4 text-chrome-ink shadow-xl"
            style={{
              paddingTop: 'max(1rem, env(safe-area-inset-top))',
              paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
            }}
          >
            <div aria-hidden className="frieze-y absolute inset-y-0 end-0" />
            <div className="flex items-center gap-3">
              <Emblem className="size-8" />
              <div>
                <p className="font-brand text-2xl font-semibold">{t('appName')}</p>
              </div>
            </div>
            <DrawerNavEntries
              block={navBlock}
              onNavigate={() => setDrawerOpen(false)}
            />
            <div className="mt-auto">{drawerAccount}</div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
