import type { ActiveView, MembershipRole, S1Permission } from '@ribat/shared';

export type NavLinkItem = { kind: 'link'; to: string; label: string };
export type NavGroupItem = {
  kind: 'group';
  label: string;
  matchPrefix: string;
  children: { to: string; label: string; end?: boolean }[];
};
export type NavEntry = NavLinkItem | NavGroupItem;

export type PhoneTab = {
  to: string;
  matchPrefix: string;
  labelKey: string;
  /** NavLink `end` for exact match (lobby home). */
  end?: boolean;
};

type TabRoute = {
  path: string;
  labelKey: string;
  matchPrefix?: string;
  end?: boolean;
};

const STAFF_TAB_ROUTES: TabRoute[] = [
  { path: '/staff', labelKey: 'nav.staff', end: true },
  { path: '/staff/members', labelKey: 'nav.members', matchPrefix: '/staff/members' },
  { path: '/staff/courses', labelKey: 'nav.tab.courses', matchPrefix: '/staff/courses' },
  { path: '/staff/reports', labelKey: 'nav.tab.reports', matchPrefix: '/staff/reports' },
  { path: '/staff/materials', labelKey: 'nav.materials', matchPrefix: '/staff/materials' },
];

const MEMBER_TAB_ROUTES: TabRoute[] = [
  { path: '/member', labelKey: 'nav.member', matchPrefix: '/member' },
  { path: '/teach', labelKey: 'nav.tab.teach', matchPrefix: '/teach' },
  { path: '/teach/reports', labelKey: 'nav.tab.reports', matchPrefix: '/teach/reports' },
];

const GUARDIAN_TAB_ROUTES: TabRoute[] = [
  { path: '/guardian', labelKey: 'nav.guardian', matchPrefix: '/guardian' },
  { path: '/notifications', labelKey: 'nav.notifications', matchPrefix: '/notifications' },
];

const OFFLINE_TAB_ROUTES: TabRoute[] = [
  { path: '/teach', labelKey: 'nav.tab.teach', matchPrefix: '/teach' },
];

const MAX_PHONE_TABS = 5;

const STAFF_MORE_PATHS = new Set([
  '/staff/materials',
  '/staff/roles',
  '/staff/excuses',
  '/staff/audit',
  '/staff/events',
  '/staff/organization',
]);

function isStaffMoreEntry(entry: NavEntry): boolean {
  return entry.kind === 'link' && STAFF_MORE_PATHS.has(entry.to);
}

/** Daily staff links first; settings and audit tucked under “More”. */
export function splitNavEntries(entries: NavEntry[]): {
  primary: NavEntry[];
  more: NavEntry[];
} {
  const primary: NavEntry[] = [];
  const more: NavEntry[] = [];
  for (const entry of entries) {
    if (isStaffMoreEntry(entry)) more.push(entry);
    else primary.push(entry);
  }
  return { primary, more };
}

/** Which links a viewer sees. The API enforces the same rules; this only hides dead ends. */
export function navFor(
  role: MembershipRole,
  activeView: ActiveView | null,
  can: (permission: S1Permission) => boolean,
): NavEntry[] {
  if (role === 'GUARDIAN')
    return [{ kind: 'link', to: '/guardian', label: 'nav.guardian' }];
  if (role === 'MEMBER' || activeView === 'MEMBER')
    return [
      { kind: 'link', to: '/member', label: 'nav.member' },
      { kind: 'link', to: '/teach', label: 'nav.teach' },
      { kind: 'link', to: '/teach/reports', label: 'nav.reports' },
    ];
  const staff: NavEntry[] = [{ kind: 'link', to: '/staff', label: 'nav.staff' }];
  if (can('members.manage')) {
    staff.push({
      kind: 'group',
      label: 'nav.members',
      matchPrefix: '/staff/members',
      children: [
        { to: '/staff/members', label: 'nav.membersDirectory', end: true },
        { to: '/staff/members/accounts', label: 'nav.accountMgmt' },
      ],
    });
  }
  if (can('courses.manage')) {
    staff.push({ kind: 'link', to: '/staff/courses', label: 'nav.courses' });
    staff.push({ kind: 'link', to: '/staff/reports', label: 'nav.reports' });
  }
  if (can('materials.manage')) {
    staff.push({ kind: 'link', to: '/staff/materials', label: 'nav.materials' });
  }
  if (can('memberships.manage')) {
    staff.push({ kind: 'link', to: '/staff/roles', label: 'nav.roles' });
  }
  if (can('members.manage')) {
    staff.push({ kind: 'link', to: '/staff/excuses', label: 'nav.excuses' });
  }
  if (can('audit.read')) {
    staff.push({ kind: 'link', to: '/staff/audit', label: 'nav.audit' });
    staff.push({ kind: 'link', to: '/staff/events', label: 'nav.events' });
  }
  if (can('organization.manage')) {
    staff.push({ kind: 'link', to: '/staff/organization', label: 'nav.organization' });
  }
  return staff;
}

export function flattenNavLinks(
  entries: NavEntry[],
): { to: string; label: string; matchPrefix: string }[] {
  const out: { to: string; label: string; matchPrefix: string }[] = [];
  for (const entry of entries) {
    if (entry.kind === 'link') {
      out.push({ to: entry.to, label: entry.label, matchPrefix: entry.to });
      continue;
    }
    for (const child of entry.children) {
      out.push({
        to: child.to,
        label: child.label,
        matchPrefix: entry.matchPrefix,
      });
    }
    out.push({
      to: entry.matchPrefix,
      label: entry.label,
      matchPrefix: entry.matchPrefix,
    });
  }
  return out;
}

/** True if this destination appears in the role nav (before notifications/devices). */
export function canReachPath(entries: NavEntry[], path: string): boolean {
  const flat = flattenNavLinks(entries);
  if (path === '/staff/members') {
    return flat.some(
      (l) =>
        l.matchPrefix === '/staff/members' || l.to.startsWith('/staff/members'),
    );
  }
  if (path === '/teach') {
    return flat.some((l) => l.to === '/teach');
  }
  if (path === '/teach/reports') {
    return flat.some((l) => l.to === '/teach/reports');
  }
  return flat.some((l) => l.to === path || l.matchPrefix === path);
}

function tabRoutesFor(entries: NavEntry[]): TabRoute[] {
  const flat = flattenNavLinks(entries);
  if (flat.some((l) => l.to === '/guardian')) return GUARDIAN_TAB_ROUTES;
  if (flat.some((l) => l.to === '/member')) return MEMBER_TAB_ROUTES;
  if (flat.length === 1 && flat[0]?.to === '/teach') return OFFLINE_TAB_ROUTES;
  return STAFF_TAB_ROUTES;
}

const PHONE_UTILITY_TAB_PATHS = new Set(['/notifications', '/account/devices']);

export function phoneTabsFromNav(entries: NavEntry[]): PhoneTab[] {
  const routes = tabRoutesFor(entries);
  return routes
    .filter(
      (route) =>
        canReachPath(entries, route.path) ||
        PHONE_UTILITY_TAB_PATHS.has(route.path),
    )
    .slice(0, MAX_PHONE_TABS)
    .map((route) => ({
      to: route.path,
      matchPrefix: route.matchPrefix ?? route.path,
      labelKey: route.labelKey,
      end: route.end,
    }));
}

type TitleMatch = { prefix: string; labelKey: string };

/** Longest nav prefix wins (member profile → Members, not Directory). */
export function mobileScreenTitleKey(
  pathname: string,
  entries: NavEntry[],
): string | null {
  const matches: TitleMatch[] = [];
  for (const entry of entries) {
    if (entry.kind === 'link') {
      matches.push({ prefix: entry.to, labelKey: entry.label });
      continue;
    }
    matches.push({ prefix: entry.matchPrefix, labelKey: entry.label });
    for (const child of entry.children) {
      matches.push({ prefix: child.to, labelKey: child.label });
    }
  }
  // Programs live under courses nav.
  if (pathname.startsWith('/staff/programs')) {
    const courses = matches.find((m) => m.prefix === '/staff/courses');
    if (courses) return courses.labelKey;
  }
  matches.sort((a, b) => b.prefix.length - a.prefix.length);
  for (const { prefix, labelKey } of matches) {
    if (prefix === '/staff') {
      if (pathname === '/staff') return labelKey;
      continue;
    }
    if (prefix === '/teach') {
      if (
        pathname === '/teach' ||
        (pathname.startsWith('/teach/') && !pathname.startsWith('/teach/reports'))
      ) {
        return labelKey;
      }
      continue;
    }
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return labelKey;
    }
  }
  return null;
}

export function isPhoneTabActive(pathname: string, tab: PhoneTab): boolean {
  if (tab.matchPrefix === '/teach' && tab.to === '/teach') {
    return (
      pathname === '/teach' ||
      (pathname.startsWith('/teach/') && !pathname.startsWith('/teach/reports'))
    );
  }
  if (tab.end) return pathname === tab.to;
  return pathname === tab.matchPrefix || pathname.startsWith(`${tab.matchPrefix}/`);
}
