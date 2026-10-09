import { PrismaClient } from '@prisma/client';
import { hashSecret } from '../src/auth/credentials';

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'demo-ribat-2026';

async function seedOrg(params: {
  slug: string;
  name: string;
  accounts: Array<{
    label: string;
    phone: string;
    role: 'SHEIKH' | 'ORG_ADMIN' | 'MEMBER' | 'GUARDIAN';
    member: {
      firstName: string;
      fatherName: string;
      familyName: string;
      birthDate: string;
    };
  }>;
}) {
  const org = await prisma.organization.upsert({
    where: { slug: params.slug },
    update: {},
    create: {
      name: params.name,
      slug: params.slug,
      timezone: 'Asia/Damascus',
      latitude: 33.5131,
      longitude: 36.3096,
      prayerMethod: 'MuslimWorldLeague',
      settings: { locale: 'ar', pointsEnabled: false },
    },
  });
  const quran = await prisma.material.create({
    data: { organizationId: org.id, kind: 'QURAN', title: 'القرآن الكريم', totalPages: 604 },
  });

  const passwordHash = await hashSecret(DEMO_PASSWORD);
  const household = await prisma.household.create({
    data: { organizationId: org.id, name: 'Al-Noor family' },
  });

  const memberByPhone = new Map<string, string>();

  for (const account of params.accounts) {
    const member = await prisma.member.create({
      data: {
        organizationId: org.id,
        firstName: account.member.firstName,
        fatherName: account.member.fatherName,
        familyName: account.member.familyName,
        birthDate: new Date(account.member.birthDate),
        joinedAt: new Date('2024-09-01'),
        phone: account.phone,
        householdId: account.role === 'MEMBER' ? household.id : null,
      },
    });
    memberByPhone.set(account.phone, member.id);

    const identity = await prisma.identity.upsert({
      where: { phone: account.phone },
      update: { passwordHash, status: 'ACTIVE' },
      create: { phone: account.phone, passwordHash, status: 'ACTIVE' },
    });

    await prisma.membership.upsert({
      where: {
        identityId_organizationId: { identityId: identity.id, organizationId: org.id },
      },
      update: { role: account.role, memberId: member.id, status: 'ACTIVE' },
      create: {
        organizationId: org.id,
        identityId: identity.id,
        memberId: member.id,
        role: account.role,
        status: 'ACTIVE',
      },
    });
  }

  const wardId = memberByPhone.get('+963999001040');
  const guardianId = memberByPhone.get('+963999001050');
  if (wardId && guardianId) {
    await prisma.guardianLink.create({
      data: {
        organizationId: org.id,
        guardianMemberId: guardianId,
        wardMemberId: wardId,
        relation: 'FATHER',
        isPrimary: true,
      },
    });
  }

  const sheikhMemberId = memberByPhone.get('+963999001001');
  if (sheikhMemberId) {
    await prisma.memberNote.create({
      data: {
        organizationId: org.id,
        memberId: wardId ?? sheikhMemberId,
        authorMemberId: sheikhMemberId,
        body: 'Fictional seed note for demo only.',
        visibility: 'STAFF',
      },
    });
  }

  // S2 demo: the member Tariq leads a Quran circle that the ward Layla attends,
  // Sunday / Tuesday / Thursday from Asr to Maghrib. The worker generates sessions on boot.
  const teacherId = memberByPhone.get('+963999001030');
  if (teacherId && wardId) {
    const course = await prisma.course.create({
      data: {
        organizationId: org.id,
        name: 'حلقة تحفيظ العصر',
        description: 'Fictional demo course.',
        type: 'MEMORIZATION',
        status: 'ACTIVE',
        startDate: new Date('2026-09-01'),
        location: 'Main hall',
        minAge: 7,
        maxAge: 16,
      },
    });
    await prisma.courseMaterial.create({
      data: { organizationId: org.id, courseId: course.id, materialId: quran.id, track: 'MEMORIZATION' },
    });
    await prisma.teachingAssignment.create({
      data: { organizationId: org.id, courseId: course.id, teacherMemberId: teacherId, role: 'LEAD' },
    });
    await prisma.enrollment.create({
      data: { organizationId: org.id, courseId: course.id, memberId: wardId, startedAt: new Date('2026-09-01') },
    });
    await prisma.courseSchedule.createMany({
      data: [0, 2, 4].map((weekday) => ({
        organizationId: org.id,
        courseId: course.id,
        weekday,
        startAnchor: 'PRAYER' as const,
        startPrayer: 'ASR' as const,
        endAnchor: 'PRAYER' as const,
        endPrayer: 'MAGHRIB' as const,
        effectiveFrom: new Date('2026-09-01'),
      })),
    });
  }

  return { org, accounts: params.accounts };
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed in production');
  }

  await prisma.auditLog.deleteMany({});
  await prisma.groupMember.deleteMany({});
  await prisma.courseGroup.deleteMany({});
  await prisma.courseSession.deleteMany({});
  await prisma.courseSchedule.deleteMany({});
  await prisma.coursePause.deleteMany({});
  await prisma.enrollment.deleteMany({});
  await prisma.teachingAssignment.deleteMany({});
  await prisma.courseRequirement.deleteMany({});
  await prisma.courseMaterial.deleteMany({});
  await prisma.guardianLink.deleteMany({});
  await prisma.memberNote.deleteMany({});
  await prisma.accountSetupCode.deleteMany({});
  await prisma.authSession.deleteMany({});
  await prisma.membership.deleteMany({});
  await prisma.member.deleteMany({});
  await prisma.household.deleteMany({});
  await prisma.course.deleteMany({});
  await prisma.material.deleteMany({});
  await prisma.organization.deleteMany({
    where: { slug: { in: ['demo-mosque', 'isolation-test-mosque'] } },
  });

  const demo = await seedOrg({
    slug: 'demo-mosque',
    name: 'Demo Mosque',
    accounts: [
      {
        label: 'sheikh',
        phone: '+963999001001',
        role: 'SHEIKH',
        member: { firstName: 'Omar', fatherName: 'Yusuf', familyName: 'Haddad', birthDate: '1975-04-01' },
      },
      {
        label: 'org_admin_1',
        phone: '+963999001010',
        role: 'ORG_ADMIN',
        member: { firstName: 'Salim', fatherName: 'Karim', familyName: 'Azem', birthDate: '1988-02-10' },
      },
      {
        label: 'org_admin_2',
        phone: '+963999001011',
        role: 'ORG_ADMIN',
        member: { firstName: 'Rami', fatherName: 'Nabil', familyName: 'Azem', birthDate: '1990-06-15' },
      },
      {
        label: 'member',
        phone: '+963999001030',
        role: 'MEMBER',
        member: { firstName: 'Tariq', fatherName: 'Salim', familyName: 'Noor', birthDate: '2005-08-20' },
      },
      {
        label: 'ward',
        phone: '+963999001040',
        role: 'MEMBER',
        member: { firstName: 'Layla', fatherName: 'Salim', familyName: 'Noor', birthDate: '2014-01-12' },
      },
      {
        label: 'guardian',
        phone: '+963999001050',
        role: 'GUARDIAN',
        member: { firstName: 'Salim', fatherName: 'Karim', familyName: 'Noor', birthDate: '1982-11-03' },
      },
    ],
  });

  const isolation = await seedOrg({
    slug: 'isolation-test-mosque',
    name: 'Isolation Test Mosque',
    accounts: [
      {
        label: 'sheikh',
        phone: '+963999002001',
        role: 'SHEIKH',
        member: { firstName: 'Isolated', fatherName: 'Test', familyName: 'Mosque', birthDate: '1970-01-01' },
      },
    ],
  });

  console.log('Seeded fictional demo data. Shared password for every seeded login:');
  console.log(`  ${DEMO_PASSWORD}`);
  console.log('');
  console.log('Demo mosque org id:', demo.org.id);
  for (const account of demo.accounts) {
    console.log(`  ${account.label}: ${account.phone} (${account.role})`);
  }
  console.log('');
  console.log('Isolation org id:', isolation.org.id);
  console.log(`  sheikh: +963999002001`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
