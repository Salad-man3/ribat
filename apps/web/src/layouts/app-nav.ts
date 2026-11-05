import type { ActiveView, MembershipRole, S1Permission } from '@ribat/shared';

export type NavLinkItem = { kind: 'link'; to: string; label: string };
export type NavGroupItem = {
  kind: 'group';
  label: string;
  matchPrefix: string;
  children: { to: string; label: string; end?: boolean }[];
};
export type NavEntry = NavLinkItem | NavGroupItem;

export type NavZoneId = 'today' | 'people' | 'teaching' | 'mosque' | 'record';

export type NavZone = {
  id: NavZoneId;
  labelKey: string;
  entries: NavEntry[];
};

export type PhoneTab = {
  to: string;
  matchPrefix: string;
  labelKey: string;
  /** NavLink `end` for exact match (lobby home). */
  end?: boolean;
  /** Path prefixes that keep this tab highlighted (e.g. teaching hub). */
  alsoActiveUnder?: string[];
};

type TabRoute = {
  path: string;
  labelKey: string;
  matchPrefix?: string;
  end?: boolean;
  alsoActiveUnder?: string[];
};

/** Four bottom tabs: Today, People, Teaching, Mosque. Everything else is in the menu drawer. */
const STAFF_TAB_ROUTES: TabRoute[] = [
  { path: '/staff', labelKey: 'nav.staff', end: true },
  {
    path: '/staff/members',
    labelKey: 'nav.zone.people',
    matchPrefix: '/staff/members',
    alsoActiveUnder: ['/staff/roles'],
  },
  {
    path: '/staff/courses',
    labelKey: 'nav.tab.courses',
    matchPrefix: '/staff/courses',
    alsoActiveUnder: [
      '/staff/reports',
      '/staff/materials',
      '/staff/excuses',
      '/staff/programs',
    ],
  },
  {
    path: '/staff/organization',
    labelKey: 'nav.zone.mosque',
    matchPrefix: '/staff/organization',
  },
];

const MEMBER_TAB_ROUTES: TabRoute[] = [
  { path: '/member', labelKey: 'nav.member', matchPrefix: '/member' },
  { path: '/teach', labelKey: 'nav.tab.teach', matchPrefix: '/teach' },
  {
    path: '/teach/reports',
    labelKey: 'nav.tab.reports',
    matchPrefix: '/teach/reports',
  },
];

const GUARDIAN_TAB_ROUTES: TabRoute[] = [
  { path: '/guardian', labelKey: 'nav.guardian', matchPrefix: '/guardian' },
  {
    path: '/notifications',
    labelKey: 'nav.notifications',
    matchPrefix: '/notifications',
  },
];

const OFFLINE_TAB_ROUTES: TabRoute[] = [
  { path: '/teach', labelKey: 'nav.tab.teach', matchPrefix: '/teach' },
];

const MAX_PHONE_TABS = 4;

const TEACHING_PATH_PREFIXES = [
  '/staff/courses',
  '/staff/reports',
  '/staff/materials',
  '/staff/excuses',
  '/staff/programs',
];

const PEOPLE_PATH_PREFIXES = ['/staff/members', '/staff/roles'];

/** Staff sidebar / drawer zones — same grouping on desktop and phone menu. */
export function navZonesFor(
  role: MembershipRole,
  activeView: ActiveView | null,
  can: (permission: S1Permission) => boolean,
): NavZone[] {
  if (role === 'GUARDIAN') {
    return [
      {
        id: 'today',
        labelKey: 'nav.zone.today',
        entries: [{ kind: 'link', to: '/guardian', label: 'nav.guardian' }],
      },
    ];
  }
  if (role === 'MEMBER' || activeView === 'MEMBER') {
    return [
      {
        id: 'today',
        labelKey: 'nav.zone.today',
        entries: [
          { kind: 'link', to: '/member', label: 'nav.member' },
          { kind: 'link', to: '/member/profile', label: 'nav.profile' },
          { kind: 'link', to: '/teach', label: 'nav.teach' },
          { kind: 'link', to: '/teach/reports', label: 'nav.reports' },
        ],
      },
    ];
  }

  const zones: NavZone[] = [
    {
      id: 'today',
      labelKey: 'nav.zone.today',
      entries: [{ kind: 'link', to: '/staff', label: 'nav.staff' }],
    },
  ];

  const people: NavEntry[] = [];
  if (can('members.manage')) {
    people.push({
      kind: 'group',
      label: 'nav.members',
      matchPrefix: '/staff/members',
      children: [
        { to: '/staff/members', label: 'nav.membersDirectory', end: true },
        { to: '/staff/members/accounts', label: 'nav.accountMgmt' },
      ],
    });
  }
  if (can('memberships.manage')) {
    people.push({ kind: 'link', to: '/staff/roles', label: 'nav.roles' });
  }
  if (people.length) {
    zones.push({ id: 'people', labelKey: 'nav.zone.people', entries: people });
  }

  const teaching: NavEntry[] = [];
  if (can('courses.manage')) {
    teaching.push({
      kind: 'link',
      to: '/staff/placement',
      label: 'placement.title',
    });
    teaching.push({ kind: 'link', to: '/staff/courses', label: 'nav.courses' });
    teaching.push({ kind: 'link', to: '/staff/doroos', label: 'nav.doroos' });
    teaching.push({
      kind: 'link',
      to: '/staff/calendar',
      label: 'nav.calendar',
    });
    teaching.push({ kind: 'link', to: '/staff/reports', label: 'nav.reports' });
  }
  if (can('materials.manage')) {
    teaching.push({
      kind: 'link',
      to: '/staff/materials',
      label: 'nav.materials',
    });
  }
  if (can('members.manage')) {
    teaching.push({ kind: 'link', to: '/staff/excuses', label: 'nav.excuses' });
  }
  if (teaching.length) {
    zones.push({
      id: 'teaching',
      labelKey: 'nav.zone.teaching',
      entries: teaching,
    });
  }

  if (can('organization.manage')) {
    zones.push({
      id: 'mosque',
      labelKey: 'nav.zone.mosque',
      entries: [
        { kind: 'link', to: '/staff/organization', label: 'nav.organization' },
      ],
    });
  }

  const record: NavEntry[] = [];
  if (can('audit.read')) {
    record.push({ kind: 'link', to: '/staff/audit', label: 'nav.audit' });
    record.push({ kind: 'link', to: '/staff/events', label: 'nav.events' });
  }
  if (record.length) {
    zones.push({ id: 'record', labelKey: 'nav.more', entries: record });
  }

  return zones;
}

/** Flat nav list (zones in order) for titles and reach checks. */
export function navFor(
  role: MembershipRole,
  activeView: ActiveView | null,
  can: (permission: S1Permission) => boolean,
): NavEntry[] {
  return navZonesFor(role, activeView, can).flatMap((z) => z.entries);
}

/** @deprecated Use navZonesFor. Kept for tests migrating off primary/more split. */
export function splitNavEntries(entries: NavEntry[]): {
  primary: NavEntry[];
  more: NavEntry[];
} {
  return { primary: entries, more: [] };
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
  if (path === '/staff/organization') {
    return flat.some((l) => l.to === '/staff/organization');
  }
  if (TEACHING_PATH_PREFIXES.includes(path)) {
    return flat.some((l) => TEACHING_PATH_PREFIXES.includes(l.to));
  }
  if (path === '/staff/roles') {
    return flat.some((l) => l.to === '/staff/roles');
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
      alsoActiveUnder: route.alsoActiveUnder,
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
  if (pathname.startsWith('/staff/programs')) {
    const courses = matches.find((m) => m.prefix === '/staff/courses');
    if (courses) return courses.labelKey;
  }
  if (
    PEOPLE_PATH_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    )
  ) {
    const people = matches.find((m) => m.prefix === '/staff/members');
    if (people) return 'nav.zone.people';
  }
  if (
    TEACHING_PATH_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    )
  ) {
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
        (pathname.startsWith('/teach/') &&
          !pathname.startsWith('/teach/reports'))
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

function pathnameUnderTab(pathname: string, tab: PhoneTab): boolean {
  const prefixes = [tab.matchPrefix, ...(tab.alsoActiveUnder ?? [])];
  for (const prefix of prefixes) {
    if (prefix === '/staff') {
      if (pathname === '/staff') return true;
      continue;
    }
    if (prefix === '/teach' && tab.to === '/teach') {
      if (
        pathname === '/teach' ||
        (pathname.startsWith('/teach/') &&
          !pathname.startsWith('/teach/reports'))
      ) {
        return true;
      }
      continue;
    }
    if (prefix === '/member' && tab.to === '/member') {
      if (pathname === '/member') return true;
      if (
        pathname.startsWith('/member/') &&
        !pathname.startsWith('/member/profile')
      ) {
        return true;
      }
      continue;
    }
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return true;
  }
  return false;
}

export function isPhoneTabActive(pathname: string, tab: PhoneTab): boolean {
  if (tab.end) return pathname === tab.to;
  return pathnameUnderTab(pathname, tab);
}
