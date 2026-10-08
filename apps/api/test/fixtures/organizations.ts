import { Organization, PrismaClient } from '@prisma/client';

const DEMO_SLUG = 'e2e-demo-mosque';
const OTHER_SLUG = 'e2e-other-mosque';

const mosque = {
    timezone: 'Asia/Damascus',
    latitude: 33.5138,
    longitude: 36.2765,
    prayerMethod: 'UmmAlQura' as const,
};

export type TwoOrganizations = {
    demo: Organization;
    other: Organization;
};

export async function twoOrganizations(prisma: PrismaClient): Promise<TwoOrganizations> {
    const demo = await prisma.organization.upsert({
        where: { slug: DEMO_SLUG },
        update: {},
        create: { name: 'E2E Demo Mosque', slug: DEMO_SLUG, ...mosque },
    });
    const other = await prisma.organization.upsert({
        where: { slug: OTHER_SLUG },
        update: {},
        create: { name: 'E2E Other Mosque', slug: OTHER_SLUG, ...mosque },
    });
    return { demo, other };
}

export async function removeTwoOrganizations(
    prisma: PrismaClient,
    orgs: TwoOrganizations,
): Promise<void> {
    const ids = [orgs.demo.id, orgs.other.id];
    const memberships = await prisma.membership.findMany({
        where: { organizationId: { in: ids } },
        select: { id: true, identityId: true },
    });
    const membershipIds = memberships.map((row) => row.id);
    const identityIds = [...new Set(memberships.map((row) => row.identityId))];

    await prisma.auditLog.deleteMany({ where: { organizationId: { in: ids } } });
    await prisma.accountSetupCode.deleteMany({
        where: {
            OR: [
                { createdByMembershipId: { in: membershipIds } },
                { identityId: { in: identityIds } },
            ],
        },
    });
    await prisma.authSession.deleteMany({ where: { identityId: { in: identityIds } } });
    await prisma.guardianLink.deleteMany({ where: { organizationId: { in: ids } } });
    await prisma.memberNote.deleteMany({ where: { organizationId: { in: ids } } });
    await prisma.member.deleteMany({ where: { organizationId: { in: ids } } });
    await prisma.household.deleteMany({ where: { organizationId: { in: ids } } });
    await prisma.membership.deleteMany({ where: { organizationId: { in: ids } } });
    await prisma.identity.deleteMany({
        where: {
            id: { in: identityIds },
            platformRole: 'NONE',
            memberships: { none: {} },
        },
    });
    await prisma.organization.deleteMany({
        where: { slug: { in: [DEMO_SLUG, OTHER_SLUG] } },
    });
}