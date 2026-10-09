import { Organization, PrismaClient } from '@prisma/client';


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

/** `prefix` keeps suites that run one after another from sharing organizations. */
export async function twoOrganizations(prisma: PrismaClient, prefix = 'e2e'): Promise<TwoOrganizations> {
    const demo = await prisma.organization.upsert({
        where: { slug: `${prefix}-demo-mosque` },
        update: {},
        create: { name: 'E2E Demo Mosque', slug: `${prefix}-demo-mosque`, ...mosque },
    });
    const other = await prisma.organization.upsert({
        where: { slug: `${prefix}-other-mosque` },
        update: {},
        create: { name: 'E2E Other Mosque', slug: `${prefix}-other-mosque`, ...mosque },
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
    const scoped = { where: { organizationId: { in: ids } } };
    await prisma.groupMember.deleteMany(scoped);
    await prisma.courseGroup.deleteMany(scoped);
    await prisma.courseSession.deleteMany(scoped);
    await prisma.courseSchedule.deleteMany(scoped);
    await prisma.coursePause.deleteMany(scoped);
    await prisma.enrollment.deleteMany(scoped);
    await prisma.teachingAssignment.deleteMany(scoped);
    await prisma.courseRequirement.deleteMany(scoped);
    await prisma.courseMaterial.deleteMany(scoped);
    await prisma.memberNote.deleteMany(scoped);
    await prisma.course.deleteMany(scoped);
    await prisma.material.deleteMany(scoped);
    await prisma.guardianLink.deleteMany({ where: { organizationId: { in: ids } } });
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
    await prisma.organization.deleteMany({ where: { id: { in: ids } } });
}