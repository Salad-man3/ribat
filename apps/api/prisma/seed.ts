import { PrismaClient } from '@prisma/client';
import { ayahsInRange, pagesForRange, SURAH_BY_NUMBER } from '@ribat/quran-data';
import { hashSecret } from '../src/auth/credentials';
import { addDays, dateIn, fromDateString, weekdayOf, zonedToUtc } from '../src/common/zoned-time';
import { organizationScopeExtension } from '../src/prisma/organization-scope';
import { writeSummary } from '../src/progress/memorization-summary';

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
    await seedClassHistory(org.id, course.id, quran.id, teacherId, wardId);
  }

  return { org, accounts: params.accounts };
}

/**
 * S3 demo: six more fictional students, two past classes with attendance and recitations,
 * and a class today so class mode has something to open on any day of the week.
 */
async function seedClassHistory(
  organizationId: string,
  courseId: string,
  quranId: string,
  teacherId: string,
  wardId: string,
) {
  const tz = 'Asia/Damascus';
  const names = ['Yusuf', 'Maryam', 'Hamza', 'Aisha', 'Bilal', 'Khadija'];
  const students = [wardId];
  for (const [i, firstName] of names.entries()) {
    const member = await prisma.member.create({
      data: {
        organizationId,
        firstName,
        fatherName: 'Demo',
        familyName: 'Student',
        birthDate: new Date(`201${i % 6}-03-0${(i % 9) + 1}`),
        joinedAt: new Date('2026-09-01'),
      },
    });
    students.push(member.id);
  }
  const enrollments = [];
  for (const memberId of students.slice(1))
    enrollments.push(
      await prisma.enrollment.create({
        data: { organizationId, courseId, memberId, startedAt: new Date('2026-09-01') },
      }),
    );
  const wardEnrollment = await prisma.enrollment.findFirstOrThrow({ where: { courseId, memberId: wardId } });
  enrollments.unshift(wardEnrollment);

  const today = dateIn(new Date(), tz);
  const session = (date: string, status: 'HELD' | 'SCHEDULED') =>
    prisma.courseSession.create({
      data: {
        organizationId,
        courseId,
        date: fromDateString(date),
        startsAt: zonedToUtc(date, '15:30', tz),
        endsAt: zonedToUtc(date, '17:30', tz),
        status,
        isException: true,
      },
    });
  // The Sun/Tue/Thu schedule generates its own session; on other days add one by hand.
  if (![0, 2, 4].includes(weekdayOf(today))) await session(today, 'SCHEDULED');

  // Each student starts from An-Nas and works back through juz 30, a common order for children.
  const statuses = ['PRESENT', 'PRESENT', 'LATE', 'PRESENT', 'ABSENT', 'PRESENT', 'EXCUSED'] as const;
  for (const [day, offset] of [-7, -5].entries()) {
    const date = addDays(today, offset);
    const held = await session(date, 'HELD');
    const at = zonedToUtc(date, '16:00', tz);
    for (const [i, enrollment] of enrollments.entries()) {
      const status = statuses[(i + day) % statuses.length];
      await prisma.attendance.create({
        data: {
          organizationId,
          sessionId: held.id,
          enrollmentId: enrollment.id,
          status,
          markedByMemberId: teacherId,
          markedAt: at,
          source: 'OFFLINE',
          idempotencyKey: crypto.randomUUID(),
        },
      });
      if (status === 'ABSENT' || status === 'EXCUSED') continue;
      const surah = 114 - day * 2 - (i % 3);
      const range = { start: { surah, ayah: 1 }, end: { surah, ayah: Math.min(5, SURAH_BY_NUMBER.get(surah)!.ayahCount) } };
      const pages = pagesForRange(range);
      await prisma.memorizationLog.create({
        data: {
          organizationId,
          memberId: enrollment.memberId,
          materialId: quranId,
          courseId,
          type: 'NEW',
          surahStart: surah,
          ayahStart: 1,
          surahEnd: surah,
          ayahEnd: range.end.ayah,
          pageFrom: pages.from,
          pageTo: pages.to,
          ayahCount: ayahsInRange(range),
          grade: i % 2 ? 'VERY_GOOD' : 'GOOD',
          mistakes: i % 3,
          loggedByMemberId: teacherId,
          loggedAt: at,
          source: 'OFFLINE',
          idempotencyKey: crypto.randomUUID(),
        },
      });
    }
  }
  const scoped = prisma.$extends(organizationScopeExtension(organizationId));
  for (const memberId of students) await writeSummary(scoped, organizationId, memberId, quranId);
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed in production');
  }

  await prisma.auditLog.deleteMany({});
  await prisma.syncMutation.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.materialLog.deleteMany({});
  await prisma.memorizationSummary.deleteMany({});
  await prisma.memorizationTest.deleteMany({});
  await prisma.memorizationLog.deleteMany({});
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
