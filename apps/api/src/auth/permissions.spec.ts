import type { MembershipRole } from '@prisma/client';
import { permissionsFor } from './permissions';

describe('permissionsFor', () => {
    it.each([
        ['SHEIKH', 'ADMIN', ['memberships.manage_org_admin']],
        ['ORG_ADMIN', 'ADMIN', []],
        ['SHEIKH', 'MEMBER', []],
        ['MEMBER', 'ADMIN', []],
        ['GUARDIAN', 'ADMIN', []],
    ] as const satisfies ReadonlyArray<
        readonly [MembershipRole, 'ADMIN' | 'MEMBER', readonly string[]]
    >)('role=%s view=%s includes %j', (role, view, extra) => {
        const perms = permissionsFor(role, view);
        const base =
            role === 'SHEIKH' || role === 'ORG_ADMIN'
                ? view === 'ADMIN'
                    ? [
                          'members.manage',
                          'memberships.manage',
                          'organization.manage',
                          'notes.write',
                          'notes.read_all',
                          'audit.read',
                          'courses.manage',
                          'materials.manage',
                      ]
                    : []
                : [];
        const expected = [...base, ...extra];
        expect(perms.sort()).toEqual([...expected].sort());
    });

    it('ORG_ADMIN in ADMIN view lacks memberships.manage_org_admin', () => {
        expect(permissionsFor('ORG_ADMIN', 'ADMIN')).not.toContain(
            'memberships.manage_org_admin',
        );
    });
});
