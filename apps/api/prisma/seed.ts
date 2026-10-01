import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const demoOrg = await prisma.organization.upsert({
        where: { slug: 'demo-mosque' },
        update: {},
        create: {
            name: 'Demo Mosque',
            slug: 'demo-mosque',
            timezone: 'Asia/Damascus',
            latitude: 33.5138,
            longitude: 36.2765,
            prayerMethod: 'UmmAlQura',
        },
    });

    const otherOrg = await prisma.organization.upsert({
        where: { slug: 'isolation-test-mosque' },
        update: {},
        create: {
            name: 'Isolation Test Mosque',
            slug: 'isolation-test-mosque',
            timezone: 'Asia/Damascus',
            latitude: 33.5138,
            longitude: 36.2765,
            prayerMethod: 'UmmAlQura',
        },
    });

    console.log('Seeded organizations:');
    console.log(`  Demo:      ${demoOrg.id}  (X-Organization-Id for local dev)`);
    console.log(`  Isolation: ${otherOrg.id}  (cross-tenant tests)`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
