import { dateIn, toDateString } from '../common/zoned-time';
import type { PrismaService } from '../prisma/prisma.service';
import { StatsRollupService } from './stats-rollup.service';

/** ADR-0010: rebuild StatsDaily from ledgers for every day with activity. */
export async function rebuildStatsForOrganization(
  prisma: PrismaService,
  organizationId: string,
  rollup: StatsRollupService,
): Promise<number> {
  const db = prisma.forOrganization(organizationId);
  const sessionDates = await db.courseSession.findMany({
    select: { date: true },
    distinct: ['date'],
  });
  const logs = await db.memorizationLog.findMany({
    where: { voidedAt: null },
    select: { loggedAt: true },
  });
  const org = await prisma.platform.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { timezone: true },
  });
  const dates = new Set<string>();
  for (const s of sessionDates) dates.add(toDateString(s.date));
  for (const l of logs) dates.add(dateIn(l.loggedAt, org.timezone));
  const sorted = [...dates].sort();
  for (const date of sorted) await rollup.rollupDay(organizationId, date);
  return sorted.length;
}
