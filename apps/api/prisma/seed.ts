import type { Prayer, Prisma, PrismaClient } from '@prisma/client';
import { createPrismaClient } from '../src/prisma/create-prisma-client.js';
import { ayahsInRange, pagesForRange, SURAH_BY_NUMBER } from '@ribat/quran-data';
import { hashSecret } from '../src/auth/credentials';
import { addDays, dateIn, fromDateString, zonedToUtc } from '../src/common/zoned-time';
import { organizationScopeExtension } from '../src/prisma/organization-scope';
import { identitiesOf, notify } from '../src/notifications/notify';
import { writeSummary } from '../src/progress/memorization-summary';

let defaultPrisma: PrismaClient | undefined;
let seedPrismaOverride: PrismaClient | undefined;

/** Browser demo snapshot builder seeds into PGlite via this hook. */
export function useSeedClient(client: PrismaClient) {
  seedPrismaOverride = client;
}

function prisma(): PrismaClient {
  return seedPrismaOverride ?? (defaultPrisma ??= createPrismaClient());
}
const DEMO_PASSWORD = 'demo-ribat-2026';
const TZ = 'Asia/Damascus';

/** Same names on every run: a small seeded generator instead of Math.random. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = rng(2026);
const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)];
const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
const shuffle = <T>(items: T[]) => [...items].sort(() => random() - 0.5);
const pad = (n: number) => String(n).padStart(2, '0');
const birth = (year: number) => `${year}-${pad(between(1, 12))}-${pad(between(1, 28))}`;
const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

const BOYS = ['محمد', 'أحمد', 'عمر', 'علي', 'يوسف', 'إبراهيم', 'خالد', 'حمزة', 'بلال', 'عبد الله', 'عبد الرحمن', 'مصطفى', 'أنس', 'زيد', 'معاذ', 'سعد', 'طه', 'ياسين', 'إياد', 'مالك', 'عثمان', 'حسن', 'حسين', 'سليمان', 'نور الدين', 'صلاح الدين', 'عمار', 'قصي'];
const GIRLS = ['فاطمة', 'عائشة', 'مريم', 'خديجة', 'زينب', 'سارة', 'آمنة', 'رقية', 'هدى', 'نور', 'سلمى', 'أسماء', 'حفصة', 'ليان', 'جنى', 'شهد', 'رغد', 'بتول', 'إسراء', 'سمية'];
const MEN = ['محمود', 'عبد الكريم', 'رضوان', 'وائل', 'ماهر', 'هشام', 'عماد', 'باسل', 'فراس', 'نزار', 'غسان', 'مازن', 'زياد', 'مروان', 'أيمن', 'بسام', 'عدنان', 'جمال', 'منير', 'سامر', 'رياض', 'فايز', 'نبيل', 'كمال'];

const FACULTIES = ['كلية الشريعة', 'كلية الهندسة المعلوماتية', 'كلية الطب البشري', 'كلية الحقوق', 'كلية الآداب', 'كلية العلوم', 'كلية الاقتصاد', 'كلية الصيدلة'];
const TEACHER_LEVELS = ['SECONDARY', 'BACHELOR', 'BACHELOR', 'MASTER', 'DIPLOMA', 'DOCTORATE', 'MIDDLE'] as const;

/** Index-driven, not random(), so adding education does not shift the rest of the seed. */
function educationFor(n: number, inSchool: boolean, student: boolean) {
  if (inSchool) return { studyStatus: 'SCHOOL' as const };
  if (student && n % 2 === 0)
    return { studyStatus: 'UNIVERSITY' as const, university: 'جامعة دمشق', faculty: FACULTIES[n % FACULTIES.length], universityYear: (n % 5) + 1 };
  const highestEducation = student ? (['SECONDARY', 'MIDDLE', 'BACHELOR'] as const)[n % 3] : TEACHER_LEVELS[n % TEACHER_LEVELS.length];
  const graduate = ['DIPLOMA', 'BACHELOR', 'MASTER', 'DOCTORATE'].includes(highestEducation);
  return { studyStatus: 'NOT_STUDYING' as const, highestEducation, faculty: graduate ? FACULTIES[n % FACULTIES.length] : undefined };
}

const FAMILIES = ['الحلبي', 'الشامي', 'العطار', 'الخطيب', 'الدمشقي', 'القباني', 'السمان', 'الصباغ', 'البيطار', 'الحموي', 'الطباع', 'النحاس', 'الجزائري', 'الحكيم', 'الرفاعي', 'العمري', 'الدقاق', 'الشهابي', 'القدسي', 'الزين', 'المصري', 'الأيوبي', 'الكردي', 'الزعبي'];

type Role = 'SHEIKH' | 'ORG_ADMIN' | 'MEMBER' | 'GUARDIAN';
type Person = {
  id: string;
  name: string;
  gender: 'M' | 'F';
  age: number;
  phone?: string;
};

async function seedDemo() {
  const today = dateIn(new Date(), TZ);
  const year = Number(today.slice(0, 4));
  const org = await prisma().organization.create({
    data: {
      name: 'مسجد النور',
      slug: 'demo-mosque',
      timezone: TZ,
      latitude: 33.5131,
      longitude: 36.3096,
      prayerMethod: 'MuslimWorldLeague',
      settings: { locale: 'ar', pointsEnabled: false },
    },
  });
  const organizationId = org.id;
  const passwordHash = await hashSecret(DEMO_PASSWORD);

  // Materials: the Quran, the classical texts the courses use, and two books kept in the library.
  const materialSpecs = {
    quran: { kind: 'QURAN', title: 'القرآن الكريم', totalPages: 604 },
    tuhfa: { kind: 'TEXT', title: 'تحفة الأطفال', author: 'سليمان الجمزوري', totalPages: 12 },
    jazariyya: { kind: 'TEXT', title: 'المقدمة الجزرية', author: 'ابن الجزري', totalPages: 20 },
    nawawi: { kind: 'TEXT', title: 'الأربعون النووية', author: 'يحيى بن شرف النووي', totalPages: 64 },
    abuShuja: { kind: 'TEXT', title: 'متن أبي شجاع', author: 'أبو شجاع الأصفهاني', totalPages: 40 },
    ajurrumiyya: { kind: 'TEXT', title: 'متن الآجرومية', author: 'ابن آجروم', totalPages: 24 },
    qatr: { kind: 'BOOK', title: 'قطر الندى وبل الصدى', author: 'ابن هشام الأنصاري', totalPages: 120 },
    nurYaqeen: { kind: 'BOOK', title: 'نور اليقين في سيرة سيد المرسلين', author: 'محمد الخضري', totalPages: 260 },
    riyad: { kind: 'BOOK', title: 'رياض الصالحين', author: 'يحيى بن شرف النووي', totalPages: 620 },
    umdah: { kind: 'BOOK', title: 'عمدة الأحكام', author: 'عبد الغني المقدسي', totalPages: 180 },
  } as const;
  type MaterialKey = keyof typeof materialSpecs;
  const material = {} as Record<MaterialKey, { id: string; kind: string; totalPages: number }>;
  for (const [key, spec] of Object.entries(materialSpecs) as [MaterialKey, (typeof materialSpecs)[MaterialKey]][]) {
    const row = await prisma().material.create({ data: { organizationId, ...spec } });
    material[key] = { id: row.id, kind: spec.kind, totalPages: spec.totalPages };
  }

  const people = new Map<string, Person>();
  const membershipOf = new Map<string, { id: string; identityId: string }>();

  async function addMember(input: {
    firstName: string;
    fatherName: string;
    familyName: string;
    motherName?: string;
    gender: 'M' | 'F';
    birthDate: string;
    phone?: string;
    householdId?: string;
    role?: Role;
    schoolGrade?: string;
    student?: boolean;
  }) {
    const education = educationFor(people.size, input.schoolGrade !== undefined, input.student === true);
    const member = await prisma().member.create({
      data: {
        organizationId,
        firstName: input.firstName,
        fatherName: input.fatherName,
        familyName: input.familyName,
        motherName: input.motherName,
        birthDate: new Date(input.birthDate),
        joinedAt: new Date(`${between(2022, 2025)}-09-01`),
        phone: input.phone,
        householdId: input.householdId,
        schoolGrade: input.schoolGrade,
        ...education,
      },
    });
    const age = year - Number(input.birthDate.slice(0, 4));
    const person = {
      id: member.id,
      name: `${input.firstName} ${input.fatherName} ${input.familyName}`,
      gender: input.gender,
      age,
      phone: input.phone,
    };
    people.set(member.id, person);
    if (input.role && input.phone) {
      const identity = await prisma().identity.upsert({
        where: { phone: input.phone },
        update: { passwordHash, status: 'ACTIVE' },
        create: { phone: input.phone, passwordHash, status: 'ACTIVE' },
      });
      const membership = await prisma().membership.create({
        data: { organizationId, identityId: identity.id, memberId: member.id, role: input.role, status: 'ACTIVE' },
      });
      membershipOf.set(member.id, { id: membership.id, identityId: identity.id });
    }
    return person;
  }

  // The six demo logins from the README keep their phones and roles.
  const noor = await prisma().household.create({ data: { organizationId, name: 'آل النوري' } });
  const sheikh = await addMember({ firstName: 'عمر', fatherName: 'يوسف', familyName: 'الحداد', gender: 'M', birthDate: '1975-04-01', phone: '+963999001001', role: 'SHEIKH' });
  await addMember({ firstName: 'سالم', fatherName: 'كريم', familyName: 'العظم', gender: 'M', birthDate: '1988-02-10', phone: '+963999001010', role: 'ORG_ADMIN' });
  await addMember({ firstName: 'رامي', fatherName: 'نبيل', familyName: 'العظم', gender: 'M', birthDate: '1990-06-15', phone: '+963999001011', role: 'ORG_ADMIN' });
  const tariq = await addMember({ firstName: 'طارق', fatherName: 'سالم', familyName: 'النوري', gender: 'M', birthDate: '2005-08-20', phone: '+963999001030', role: 'MEMBER', householdId: noor.id });
  const ward = await addMember({ firstName: 'يوسف', fatherName: 'سالم', familyName: 'النوري', motherName: 'هدى الشامي', gender: 'M', birthDate: '2014-01-12', phone: '+963999001040', role: 'MEMBER', householdId: noor.id, schoolGrade: 'السادس' });
  const salim = await addMember({ firstName: 'سالم', fatherName: 'كريم', familyName: 'النوري', gender: 'M', birthDate: '1982-11-03', phone: '+963999001050', role: 'GUARDIAN', householdId: noor.id });
  await prisma().guardianLink.create({
    data: { organizationId, guardianMemberId: salim.id, wardMemberId: ward.id, relation: 'FATHER', isPrimary: true },
  });

  // Nine more teachers, each able to sign in for class mode.
  const teachers = [tariq];
  const teacherNames = shuffle(MEN).slice(0, 9);
  for (const [i, firstName] of teacherNames.entries()) {
    teachers.push(
      await addMember({
        firstName: i < 2 ? `الشيخ ${firstName}` : firstName,
        fatherName: pick(MEN),
        familyName: FAMILIES[i],
        gender: 'M',
        birthDate: birth(between(1968, 1998)),
        phone: `+9639990011${pad(i + 1)}`,
        role: 'MEMBER',
      }),
    );
  }

  // 24 fathers, each with a household and one to three children.
  const guardians: Person[] = [];
  const kids: Person[] = [ward];
  const wardsOf = new Map<string, Person[]>([[salim.id, [ward]]]);
  for (let i = 0; i < 24; i++) {
    const familyName = FAMILIES[i];
    const household = await prisma().household.create({ data: { organizationId, name: `آل ${familyName}` } });
    const fatherFirst = MEN[i];
    const father = await addMember({
      firstName: fatherFirst,
      fatherName: pick(MEN),
      familyName,
      gender: 'M',
      birthDate: birth(between(1972, 1992)),
      phone: `+9639990012${pad(i + 1)}`,
      role: 'GUARDIAN',
      householdId: household.id,
    });
    guardians.push(father);
    const mother = `${pick(GIRLS)} ${pick(FAMILIES)}`;
    const children: Person[] = [];
    const count = i < 2 ? 1 : i % 3 === 0 ? 3 : 2;
    for (let c = 0; c < count && kids.length < 49; c++) {
      const gender = random() < 0.55 ? 'M' : 'F';
      const birthYear = between(year - 14, year - 6);
      children.push(
        await addMember({
          firstName: gender === 'M' ? pick(BOYS) : pick(GIRLS),
          fatherName: fatherFirst,
          familyName,
          motherName: mother,
          gender,
          birthDate: birth(birthYear),
          householdId: household.id,
          schoolGrade: `الصف ${year - birthYear - 5}`,
        }),
      );
    }
    kids.push(...children);
    wardsOf.set(father.id, children);
    await prisma().guardianLink.createMany({
      data: children.map((child) => ({ organizationId, guardianMemberId: father.id, wardMemberId: child.id, relation: 'FATHER' as const, isPrimary: true })),
    });
  }

  // Adult students fill the count to exactly 100 members.
  const adults: Person[] = [];
  for (let i = 0; people.size < 100; i++) {
    const gender = i % 4 === 3 ? 'F' : 'M';
    adults.push(
      await addMember({
        firstName: gender === 'M' ? pick([...BOYS, ...MEN]) : pick(GIRLS),
        fatherName: pick(MEN),
        familyName: pick(FAMILIES),
        gender,
        birthDate: birth(between(1975, year - 18)),
        phone: `+9639990013${pad(i + 1)}`,
        student: true,
      }),
    );
  }

  // Ten courses: five Quran circles, two that pair a text with its explanation, three lessons.
  type CourseSpec = {
    name: string;
    description: string;
    type: 'MEMORIZATION' | 'EXPLANATION' | 'BOTH';
    location: string;
    minAge?: number;
    maxAge?: number;
    weekdays: number[];
    from: string;
    to: string;
    prayer?: { start: Prayer; end: Prayer };
    memorize?: MaterialKey;
    explain?: MaterialKey;
    lead: Person;
    students: Person[];
  };
  const byAge = (min: number, max: number, gender?: 'M' | 'F') =>
    kids.filter((k) => k.age >= min && k.age <= max && (!gender || k.gender === gender) && k !== ward);
  const take = (list: Person[], n: number) => shuffle(list).slice(0, n);

  const courses: CourseSpec[] = [
    { name: 'حلقة تحفيظ العصر', description: 'حفظ جزء عمّ وتبارك للأولاد بين العصر والمغرب.', type: 'MEMORIZATION', location: 'المصلى الرئيسي', minAge: 7, maxAge: 16, weekdays: [0, 2, 4], from: '15:30', to: '17:30', prayer: { start: 'ASR', end: 'MAGHRIB' }, memorize: 'quran', lead: tariq, students: [ward, ...take(byAge(9, 14, 'M'), 10)] },
    { name: 'حلقة الفجر للكبار', description: 'حفظ ومراجعة للكبار بعد صلاة الفجر.', type: 'MEMORIZATION', location: 'المصلى الرئيسي', minAge: 18, weekdays: [6, 1, 3], from: '05:15', to: '06:15', prayer: { start: 'FAJR', end: 'SUNRISE' }, memorize: 'quran', lead: teachers[1], students: [...take(adults, 7), ...take(guardians, 4)] },
    { name: 'حلقة البراعم', description: 'تلقين قصار السور للصغار.', type: 'MEMORIZATION', location: 'قاعة الأطفال', minAge: 5, maxAge: 8, weekdays: [6, 1, 3], from: '16:00', to: '17:00', memorize: 'quran', lead: teachers[2], students: take(byAge(5, 8), 11) },
    { name: 'حلقة الفتيات', description: 'حلقة تحفيظ للبنات يوم الجمعة والسبت.', type: 'MEMORIZATION', location: 'مصلى النساء', minAge: 9, maxAge: 15, weekdays: [5, 6], from: '10:00', to: '12:00', memorize: 'quran', lead: teachers[3], students: take(byAge(9, 14, 'F'), 11) },
    { name: 'حلقة المراجعة والتثبيت', description: 'مراجعة المحفوظ وتثبيته بين المغرب والعشاء.', type: 'MEMORIZATION', location: 'المكتبة', minAge: 12, weekdays: [0, 3], from: '18:30', to: '19:45', prayer: { start: 'MAGHRIB', end: 'ISHA' }, memorize: 'quran', lead: teachers[4], students: [...take(byAge(12, 14), 5), ...take(adults.filter((a) => a.age <= 30), 4)] },
    { name: 'دورة التجويد', description: 'حفظ تحفة الأطفال وشرح المقدمة الجزرية.', type: 'BOTH', location: 'قاعة الدروس', minAge: 10, weekdays: [1, 3], from: '17:30', to: '18:30', memorize: 'tuhfa', explain: 'jazariyya', lead: teachers[5], students: take(byAge(10, 14), 9) },
    { name: 'درس الأربعين النووية', description: 'شرح حديث كل أسبوع بعد العشاء.', type: 'EXPLANATION', location: 'المصلى الرئيسي', weekdays: [4], from: '20:00', to: '21:00', explain: 'nawawi', lead: sheikh, students: [...take(guardians, 8), ...take(adults, 4)] },
    { name: 'درس الفقه الميسر', description: 'شرح متن أبي شجاع في فقه العبادات.', type: 'EXPLANATION', location: 'قاعة الدروس', weekdays: [1], from: '19:00', to: '20:00', explain: 'abuShuja', lead: teachers[6], students: [...take(guardians, 6), ...take(adults, 4)] },
    { name: 'مجلس السيرة النبوية', description: 'قراءة في السيرة للأسر بعد عصر الجمعة.', type: 'EXPLANATION', location: 'المصلى الرئيسي', weekdays: [5], from: '16:30', to: '17:30', explain: 'nurYaqeen', lead: teachers[7], students: [...take(byAge(10, 14), 6), ...take(guardians, 4)] },
    { name: 'حلقة متون اللغة', description: 'حفظ الآجرومية وشرح قطر الندى.', type: 'BOTH', location: 'المكتبة', minAge: 12, weekdays: [2, 4], from: '17:00', to: '18:00', memorize: 'ajurrumiyya', explain: 'qatr', lead: teachers[8], students: [...take(byAge(12, 14), 4), ...take(adults, 4)] },
  ];

  const historyFrom = addDays(today, -28);
  const attendanceRows: Prisma.AttendanceCreateManyInput[] = [];
  const logRows: Prisma.MemorizationLogCreateManyInput[] = [];
  const materialLogRows: Prisma.MaterialLogCreateManyInput[] = [];
  const summaries = new Set<string>();
  const quranPos = new Map<string, { surah: number; ayah: number; dir: 1 | -1; last?: { surah: number; from: number; to: number } }>();
  const textPos = new Map<string, number>();
  const enrollmentsByCourse = new Map<string, { id: string; memberId: string }[]>();
  const courseIds: string[] = [];

  for (const [index, spec] of courses.entries()) {
    const students = [...new Map(spec.students.map((s) => [s.id, s])).values()];
    const course = await prisma().course.create({
      data: {
        organizationId,
        name: spec.name,
        description: spec.description,
        type: spec.type,
        status: 'ACTIVE',
        startDate: new Date(`${year - (index % 2)}-09-01`),
        location: spec.location,
        minAge: spec.minAge,
        maxAge: spec.maxAge,
        capacity: 15,
      },
    });
    courseIds.push(course.id);
    if (spec.memorize)
      await prisma().courseMaterial.create({ data: { organizationId, courseId: course.id, materialId: material[spec.memorize].id, track: 'MEMORIZATION' } });
    if (spec.explain)
      await prisma().courseMaterial.create({ data: { organizationId, courseId: course.id, materialId: material[spec.explain].id, track: 'EXPLANATION', order: 1 } });
    await prisma().teachingAssignment.create({ data: { organizationId, courseId: course.id, teacherMemberId: spec.lead.id, role: 'LEAD' } });
    if (index === 2) // Tariq also helps with the little ones, so his class mode lists two circles.
      await prisma().teachingAssignment.create({ data: { organizationId, courseId: course.id, teacherMemberId: tariq.id, role: 'TEACHER' } });
    await prisma().courseSchedule.createMany({
      data: spec.weekdays.map((weekday) => ({
        organizationId,
        courseId: course.id,
        weekday,
        effectiveFrom: new Date(`${year - 1}-09-01`),
        ...(spec.prayer
          ? { startAnchor: 'PRAYER' as const, startPrayer: spec.prayer.start, endAnchor: 'PRAYER' as const, endPrayer: spec.prayer.end }
          : { startAnchor: 'FIXED' as const, startTime: spec.from, endAnchor: 'FIXED' as const, endTime: spec.to }),
      })),
    });

    const enrollments = [];
    for (const student of students)
      enrollments.push(
        await prisma().enrollment.create({
          data: { organizationId, courseId: course.id, memberId: student.id, startedAt: fromDateString(historyFrom) },
        }),
      );
    enrollmentsByCourse.set(course.id, enrollments);

    // Four weeks of held classes on the course's own days. The worker generates from today on.
    let explainPage = between(1, 10);
    for (let date = historyFrom; date < today; date = addDays(date, 1)) {
      if (!spec.weekdays.includes(weekdayOf(date))) continue;
      const session = await prisma().courseSession.create({
        data: {
          organizationId,
          courseId: course.id,
          date: fromDateString(date),
          startsAt: zonedToUtc(date, spec.from, TZ),
          endsAt: zonedToUtc(date, spec.to, TZ),
          status: 'HELD',
          isException: true,
        },
      });
      const at = zonedToUtc(date, spec.from, TZ);
      for (const enrollment of enrollments) {
        const roll = random();
        const status = roll < 0.74 ? 'PRESENT' : roll < 0.85 ? 'LATE' : roll < 0.95 ? 'ABSENT' : 'EXCUSED';
        attendanceRows.push({
          organizationId,
          sessionId: session.id,
          enrollmentId: enrollment.id,
          status,
          markedByMemberId: spec.lead.id,
          markedAt: at,
          source: random() < 0.6 ? 'OFFLINE' : 'ONLINE',
          idempotencyKey: crypto.randomUUID(),
        });
        if (status === 'ABSENT' || status === 'EXCUSED' || !spec.memorize) continue;
        const grade = pick(['EXCELLENT', 'VERY_GOOD', 'VERY_GOOD', 'GOOD', 'GOOD', 'REPEAT'] as const);
        const base = {
          organizationId,
          memberId: enrollment.memberId,
          materialId: material[spec.memorize].id,
          courseId: course.id,
          grade,
          mistakes: grade === 'EXCELLENT' ? 0 : between(0, 4),
          loggedByMemberId: spec.lead.id,
          loggedAt: at,
          source: 'OFFLINE' as const,
          idempotencyKey: crypto.randomUUID(),
        };
        summaries.add(`${enrollment.memberId}|${material[spec.memorize].id}`);

        if (spec.memorize === 'quran') {
          // Children work back from An-Nas through juz 30 and 29; adults read forward.
          const person = people.get(enrollment.memberId)!;
          let pos = quranPos.get(person.id);
          if (!pos) {
            pos = person.age < 16
              ? { surah: 114 - between(0, Math.max(0, person.age - 6) * 3), ayah: 1, dir: -1 }
              : { surah: between(2, 40), ayah: 1, dir: 1 };
            quranPos.set(person.id, pos);
          }
          if (pos.last && random() < 0.2) {
            const range = { start: { surah: pos.last.surah, ayah: pos.last.from }, end: { surah: pos.last.surah, ayah: pos.last.to } };
            const pages = pagesForRange(range);
            logRows.push({ ...base, type: 'REVISION', surahStart: pos.last.surah, ayahStart: pos.last.from, surahEnd: pos.last.surah, ayahEnd: pos.last.to, pageFrom: pages.from, pageTo: pages.to, ayahCount: ayahsInRange(range) });
            continue;
          }
          const count = SURAH_BY_NUMBER.get(pos.surah)!.ayahCount;
          const to = Math.min(count, pos.ayah + between(person.age < 9 ? 2 : 4, person.age < 9 ? 4 : 9));
          const range = { start: { surah: pos.surah, ayah: pos.ayah }, end: { surah: pos.surah, ayah: to } };
          const pages = pagesForRange(range);
          logRows.push({ ...base, type: 'NEW', surahStart: pos.surah, ayahStart: pos.ayah, surahEnd: pos.surah, ayahEnd: to, pageFrom: pages.from, pageTo: pages.to, ayahCount: ayahsInRange(range) });
          pos.last = { surah: pos.surah, from: pos.ayah, to };
          if (grade === 'REPEAT') continue; // repeats the same passage next time
          if (to === count) Object.assign(pos, { surah: Math.min(114, Math.max(1, pos.surah + pos.dir)), ayah: 1 });
          else pos.ayah = to + 1;
        } else {
          const key = `${enrollment.memberId}|${spec.memorize}`;
          const page = textPos.get(key) ?? 1;
          const last = Math.min(material[spec.memorize].totalPages, page + (grade === 'REPEAT' ? 0 : 1));
          logRows.push({ ...base, type: 'NEW', pageFrom: page, pageTo: last });
          textPos.set(key, grade === 'REPEAT' ? page : Math.min(last + 1, material[spec.memorize].totalPages));
        }
      }
      if (spec.explain) {
        const to = Math.min(material[spec.explain].totalPages, explainPage + between(1, 3));
        materialLogRows.push({
          organizationId,
          sessionId: session.id,
          materialId: material[spec.explain].id,
          pageFrom: explainPage,
          pageTo: to,
          loggedByMemberId: spec.lead.id,
          loggedAt: zonedToUtc(date, spec.to, TZ),
          source: 'ONLINE',
          idempotencyKey: crypto.randomUUID(),
        });
        explainPage = Math.min(to + 1, material[spec.explain].totalPages);
      }
    }

    // Homework: last week's is closed out, this week's is still open.
    const memberTitle = spec.memorize === 'quran' ? 'مراجعة محفوظ الأسبوع' : spec.memorize ? `حفظ صفحتين من ${materialSpecs[spec.memorize].title}` : `قراءة الدرس القادم من ${materialSpecs[spec.explain!].title}`;
    for (const [offset, open] of [[-4, false], [3, true]] as const) {
      const homework = await prisma().homework.create({
        data: { organizationId, courseId: course.id, targetType: 'COURSE', title: memberTitle, description: 'مرتين في البيت قبل الحلقة.', dueDate: fromDateString(addDays(today, offset)), createdByMemberId: spec.lead.id },
      });
      await prisma().homeworkTask.createMany({
        data: enrollments.map((e) => {
          const status = open ? (random() < 0.3 ? 'DONE' : 'ASSIGNED') : random() < 0.8 ? 'DONE' : 'MISSED';
          return { organizationId, homeworkId: homework.id, enrollmentId: e.id, status, ...(status !== 'ASSIGNED' ? { markedByMemberId: spec.lead.id, markedAt: zonedToUtc(addDays(today, offset), '18:00', TZ) } : {}) } as const;
        }),
      });
    }
  }

  // Class mode has something to open on any day: an extra evening class for Tariq today.
  await prisma().courseSession.create({
    data: { organizationId, courseId: courseIds[0], date: fromDateString(today), startsAt: zonedToUtc(today, '18:00', TZ), endsAt: zonedToUtc(today, '20:00', TZ), status: 'SCHEDULED', isException: true, topic: 'مراجعة سورة النبأ' },
  });

  const chunk = async <T>(rows: T[], write: (part: T[]) => Promise<unknown>) => {
    for (let i = 0; i < rows.length; i += 500) await write(rows.slice(i, i + 500));
  };
  await chunk(attendanceRows, (data) => prisma().attendance.createMany({ data }));
  await chunk(logRows, (data) => prisma().memorizationLog.createMany({ data }));
  await chunk(materialLogRows, (data) => prisma().materialLog.createMany({ data }));

  const scoped = prisma().$extends(organizationScopeExtension(organizationId));
  for (const key of summaries) {
    const [memberId, materialId] = key.split('|');
    await writeSummary(scoped, organizationId, memberId, materialId);
  }

  // Tests on whole surahs the children have finished.
  const finished = [...quranPos.entries()].filter(([, pos]) => pos.dir === -1 && pos.surah < 114);
  for (const [memberId, pos] of finished.slice(0, 24)) {
    const surah = pos.surah + 1;
    const score = between(48, 99);
    const courseId = [...enrollmentsByCourse.entries()].find(([, rows]) => rows.some((r) => r.memberId === memberId))?.[0];
    await prisma().memorizationTest.create({
      data: {
        organizationId,
        memberId,
        materialId: material.quran.id,
        courseId,
        scopeType: 'SURAH',
        surahStart: surah,
        ayahStart: 1,
        surahEnd: surah,
        ayahEnd: SURAH_BY_NUMBER.get(surah)!.ayahCount,
        score,
        passMark: 60,
        passed: score >= 60,
        attemptNo: 1,
        examinerMemberId: pick([sheikh, teachers[1], teachers[4]]).id,
        takenAt: zonedToUtc(addDays(today, -between(1, 20)), '17:00', TZ),
        notes: score < 60 ? 'يعيد الاختبار بعد أسبوع' : undefined,
        idempotencyKey: crypto.randomUUID(),
      },
    });
  }
  await prisma().memorizationTest.create({
    data: { organizationId, memberId: ward.id, materialId: material.quran.id, courseId: courseIds[0], scopeType: 'JUZ', juz: 30, score: 86, passMark: 60, passed: true, attemptNo: 1, examinerMemberId: tariq.id, takenAt: zonedToUtc(addDays(today, -5), '17:00', TZ), idempotencyKey: crypto.randomUUID() },
  });

  // Excuses in every state, from the fathers.
  const sheikhMembership = membershipOf.get(sheikh.id)!;
  const reasons = ['سفر عائلي', 'مرض', 'امتحانات المدرسة', 'موعد طبيب', 'زيارة الأقارب', 'عرس في العائلة'];
  const families = [...wardsOf.entries()].filter(([, wards]) => wards.length);
  for (const [i, [guardianId, wards]] of families.slice(0, 9).entries()) {
    const child = wards[0];
    const status = i < 3 ? 'PENDING' : i < 7 ? 'ACCEPTED' : 'REJECTED';
    const day = addDays(today, i < 3 ? i + 1 : -(i * 2));
    await prisma().excuseRequest.create({
      data: {
        organizationId,
        memberId: child.id,
        fromDate: fromDateString(day),
        toDate: fromDateString(addDays(day, i % 2)),
        reason: reasons[i % reasons.length],
        submittedByIdentityId: membershipOf.get(guardianId)!.identityId,
        status,
        ...(status !== 'PENDING' ? { decidedByMembershipId: sheikhMembership.id, decidedAt: zonedToUtc(day, '09:00', TZ) } : {}),
      },
    });
  }

  // Staff notes: a few for the sheikh only, the rest for all staff.
  const notes = ['متقن للحفظ، يحتاج إلى تحسين المخارج.', 'كثير الغياب هذا الشهر، تم التواصل مع الوالد.', 'تقدّم ملحوظ في التجويد.', 'يُرشَّح لحلقة المراجعة.', 'يحتاج إلى متابعة في البيت.', 'صوت حسن، يُشجَّع على الأذان.', 'ضعف في مراجعة القديم.', 'من المتميزين في الحلقة.'];
  for (const [i, kid] of shuffle(kids).slice(0, 14).entries()) {
    await prisma().memberNote.create({
      data: { organizationId, memberId: kid.id, authorMemberId: i % 3 ? pick(teachers).id : sheikh.id, body: notes[i % notes.length], visibility: i % 4 === 0 ? 'SHEIKH_ONLY' : 'STAFF' },
    });
  }

  // The demo ward's father has something in his inbox.
  const db = prisma().$extends(organizationScopeExtension(organizationId));
  const family = await identitiesOf(db, [salim.id]);
  const asr = courses[0].name;
  await notify(db, organizationId, family, { type: 'TEST_RESULT', params: { student: ward.name, course: asr, score: 86, passed: true }, entityType: 'member', entityId: ward.id }, 'seed:test');
  await notify(db, organizationId, family, { type: 'HOMEWORK_ASSIGNED', params: { title: 'مراجعة محفوظ الأسبوع', course: asr, dueDate: addDays(today, 3) }, entityType: 'member', entityId: ward.id }, 'seed:homework');
  await notify(db, organizationId, family, { type: 'ABSENCE_SUMMARY', params: { date: addDays(today, -5), count: 1, items: [{ student: ward.name, course: asr, status: 'LATE' }] } }, 'seed:absence');

  return {
    org,
    counts: { members: people.size, courses: courses.length, materials: Object.keys(material).length, attendance: attendanceRows.length, recitations: logRows.length, lessonLogs: materialLogRows.length },
  };
}

async function seedIsolation() {
  const org = await prisma().organization.create({
    data: { name: 'مسجد اختبار العزل', slug: 'isolation-test-mosque', timezone: TZ, latitude: 33.5131, longitude: 36.3096, prayerMethod: 'MuslimWorldLeague', settings: { locale: 'ar', pointsEnabled: false } },
  });
  const passwordHash = await hashSecret(DEMO_PASSWORD);
  const member = await prisma().member.create({
    data: { organizationId: org.id, firstName: 'معزول', fatherName: 'اختبار', familyName: 'المسجد', birthDate: new Date('1970-01-01'), joinedAt: new Date('2024-09-01'), phone: '+963999002001' },
  });
  const identity = await prisma().identity.upsert({
    where: { phone: '+963999002001' },
    update: { passwordHash, status: 'ACTIVE' },
    create: { phone: '+963999002001', passwordHash, status: 'ACTIVE' },
  });
  await prisma().membership.create({ data: { organizationId: org.id, identityId: identity.id, memberId: member.id, role: 'SHEIKH', status: 'ACTIVE' } });
  await prisma().material.create({ data: { organizationId: org.id, kind: 'QURAN', title: 'القرآن الكريم', totalPages: 604 } });
  return org;
}

export async function runSeed(client: PrismaClient) {
  useSeedClient(client);
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed in production');
  }

  await prisma().auditLog.deleteMany({});
  await prisma().eventDelivery.deleteMany({});
  await prisma().domainEvent.deleteMany({});
  await prisma().notification.deleteMany({});
  await prisma().homeworkTask.deleteMany({});
  await prisma().homework.deleteMany({});
  await prisma().excuseRequest.deleteMany({});
  await prisma().syncMutation.deleteMany({});
  await prisma().attendance.deleteMany({});
  await prisma().materialLog.deleteMany({});
  await prisma().memorizationSummary.deleteMany({});
  await prisma().memorizationTest.deleteMany({});
  await prisma().memorizationLog.deleteMany({});
  await prisma().groupMember.deleteMany({});
  await prisma().courseGroup.deleteMany({});
  await prisma().courseSession.deleteMany({});
  await prisma().courseSchedule.deleteMany({});
  await prisma().coursePause.deleteMany({});
  await prisma().enrollment.deleteMany({});
  await prisma().teachingAssignment.deleteMany({});
  await prisma().courseRequirement.deleteMany({});
  await prisma().courseMaterial.deleteMany({});
  await prisma().guardianLink.deleteMany({});
  await prisma().memberNote.deleteMany({});
  await prisma().accountSetupCode.deleteMany({});
  await prisma().authSession.deleteMany({});
  await prisma().membership.deleteMany({});
  await prisma().member.deleteMany({});
  await prisma().household.deleteMany({});
  await prisma().course.deleteMany({});
  await prisma().material.deleteMany({});
  await prisma().organization.deleteMany({
    where: { slug: { in: ['demo-mosque', 'isolation-test-mosque'] } },
  });

  const demo = await seedDemo();
  const isolation = await seedIsolation();

  console.log('Seeded fictional demo data. Shared password for every seeded login:');
  console.log(`  ${DEMO_PASSWORD}`);
  console.log('');
  console.log('Demo mosque org id:', demo.org.id, demo.counts);
  console.log('  sheikh: +963999001001 · admins: +963999001010, +963999001011');
  console.log('  teacher (class mode): +963999001030 · other teachers: +963999001101…109');
  console.log('  student: +963999001040 · guardian: +963999001050 · other guardians: +963999001201…224');
  console.log('');
  console.log('Isolation org id:', isolation.id);
  console.log('  sheikh: +963999002001');
}

async function main() {
  await runSeed(prisma());
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('prisma/seed.ts')) {
  main()
    .catch(console.error)
    .finally(async () => {
      await defaultPrisma?.$disconnect();
    });
}
