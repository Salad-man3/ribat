import type { ActiveView, S1Permission } from '@ribat/shared';
import type { MembershipRole } from '@prisma/client';

const STAFF_ROLES = new Set<MembershipRole>(['SHEIKH', 'ORG_ADMIN']);

const STAFF_ADMIN_PERMISSIONS: S1Permission[] = [
    'members.manage',
    'memberships.manage',
    'organization.manage',
    'notes.write',
    'notes.read_all',
    'audit.read',
    'courses.manage',
    'materials.manage',
];

export function isStaff(role: MembershipRole): boolean {
    return STAFF_ROLES.has(role);
}

export function permissionsFor(
    role: MembershipRole,
    activeView: ActiveView,
): S1Permission[] {
    if (!isStaff(role) || activeView !== 'ADMIN') {
        return [];
    }
    const keys = [...STAFF_ADMIN_PERMISSIONS];
    if (role === 'SHEIKH') {
        keys.push('memberships.manage_org_admin');
    }
    return keys;
}
