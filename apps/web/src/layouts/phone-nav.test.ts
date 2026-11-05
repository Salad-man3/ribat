import { describe, expect, it } from 'vitest';
import type { S1Permission } from '@ribat/shared';
import { navFor, phoneTabsFromNav } from './app-nav';

const allPerms = (_: S1Permission) => true;
const noPerms = (_: S1Permission) => false;

describe('phoneTabsFromNav', () => {
  it('staff with full permissions returns four zone tabs', () => {
    const entries = navFor('ORG_ADMIN', 'ADMIN', allPerms);
    const tabs = phoneTabsFromNav(entries);
    expect(tabs.map((t) => t.matchPrefix)).toEqual([
      '/staff',
      '/staff/members',
      '/staff/courses',
      '/staff/organization',
    ]);
  });

  it('never returns more than four staff tabs', () => {
    const entries = navFor('ORG_ADMIN', 'ADMIN', allPerms);
    expect(phoneTabsFromNav(entries).length).toBeLessThanOrEqual(4);
  });

  it('drops tabs the role cannot reach instead of backfilling', () => {
    const entries = navFor('ORG_ADMIN', 'ADMIN', (p) => p === 'courses.manage');
    const tabs = phoneTabsFromNav(entries);
    expect(tabs.map((t) => t.matchPrefix)).toEqual([
      '/staff',
      '/staff/courses',
    ]);
  });

  it('member view uses portal, class, and reports tabs', () => {
    const entries = navFor('ORG_ADMIN', 'MEMBER', allPerms);
    expect(phoneTabsFromNav(entries).map((t) => t.to)).toEqual([
      '/member',
      '/teach',
      '/teach/reports',
    ]);
  });

  it('guardian gets family and notifications tabs', () => {
    const entries = navFor('GUARDIAN', null, noPerms);
    expect(phoneTabsFromNav(entries).map((t) => t.to)).toEqual([
      '/guardian',
      '/notifications',
    ]);
  });

  it('offline class mode is teach only', () => {
    const entries: ReturnType<typeof navFor> = [
      { kind: 'link', to: '/teach', label: 'nav.teach' },
    ];
    expect(phoneTabsFromNav(entries).map((t) => t.to)).toEqual(['/teach']);
  });
});
