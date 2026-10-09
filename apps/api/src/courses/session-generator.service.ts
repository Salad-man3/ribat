import { Injectable } from '@nestjs/common';
import { addDays, dateIn, toDateString } from '../common/zoned-time';
import { toOrganizationResponse } from '../organizations/organization.mapper';
import type { PrayerSettings } from '../prayer-times/compute';
import { PrismaService } from '../prisma/prisma.service';
import { generateSessions } from './generate';

/** T211: sessions exist four weeks ahead. */
export const HORIZON_DAYS = 28;

const keyOf = (s: { date: Date | string; startsAt: Date }) =>
  `${typeof s.date === 'string' ? s.date : toDateString(s.date)}|${s.startsAt.toISOString()}`;

@Injectable()
export class SessionGeneratorService {
  constructor(private readonly prisma: PrismaService) {}

  async settingsFor(organizationId: string): Promise<PrayerSettings> {
    const org = await this.prisma.platform.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    return toOrganizationResponse(org);
  }

  /**
   * Reconciles one course's future generated sessions with its schedule:
   * inserts what is missing and deletes future SCHEDULED rows that no longer match
   * (schedule edited, pause added, prayer offsets changed, course paused or finished).
   * Hand-added sessions (scheduleId null) and past sessions are never touched.
   * Safe to run any number of times.
   */
  async reconcileCourse(
    organizationId: string,
    courseId: string,
  ): Promise<{ created: number; removed: number }> {
    const db = this.prisma.forOrganization(organizationId);
    const course = await db.course.findFirst({ where: { id: courseId } });
    if (!course) return { created: 0, removed: 0 };

    const settings = await this.settingsFor(organizationId);
    const today = dateIn(new Date(), settings.timezone);
    const now = new Date();

    let wanted: ReturnType<typeof generateSessions> = [];
    if (course.status === 'ACTIVE') {
      const [rules, pauses] = await Promise.all([
        db.courseSchedule.findMany({ where: { courseId } }),
        db.coursePause.findMany({ where: { courseId } }),
      ]);
      wanted = generateSessions({
        settings,
        course: {
          startDate: course.startDate ? toDateString(course.startDate) : null,
          endDate: course.endDate ? toDateString(course.endDate) : null,
        },
        rules: rules.map((r) => ({
          ...r,
          effectiveFrom: toDateString(r.effectiveFrom),
          effectiveTo: r.effectiveTo ? toDateString(r.effectiveTo) : null,
        })),
        pauses: pauses.map((p) => ({
          fromDate: toDateString(p.fromDate),
          toDate: toDateString(p.toDate),
        })),
        from: today,
        to: addDays(today, HORIZON_DAYS - 1),
      }).filter((s) => s.startsAt > now);
    }

    const wantedKeys = new Set(wanted.map(keyOf));
    // ponytail: S3 must also keep sessions that already have attendance rows.
    const future = await db.courseSession.findMany({
      where: {
        courseId,
        status: 'SCHEDULED',
        scheduleId: { not: null },
        startsAt: { gt: now },
      },
      select: { id: true, date: true, startsAt: true },
    });
    const stale = future
      .filter((s) => !wantedKeys.has(keyOf(s)))
      .map((s) => s.id);
    const removed = stale.length
      ? (await db.courseSession.deleteMany({ where: { id: { in: stale } } }))
          .count
      : 0;

    const { count: created } = await db.courseSession.createMany({
      data: wanted.map((s) => ({
        organizationId,
        courseId,
        date: new Date(`${s.date}T00:00:00.000Z`),
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        scheduleId: s.scheduleId,
      })),
      skipDuplicates: true,
    });
    return { created, removed };
  }

  /** Nightly job: every active, paused or finished course (the latter two only lose future rows). */
  async reconcileOrganization(organizationId: string): Promise<number> {
    const courses = await this.prisma
      .forOrganization(organizationId)
      .course.findMany({
        where: { status: { in: ['ACTIVE', 'PAUSED', 'FINISHED'] } },
        select: { id: true },
      });
    let created = 0;
    for (const course of courses)
      created += (await this.reconcileCourse(organizationId, course.id))
        .created;
    return created;
  }
}
