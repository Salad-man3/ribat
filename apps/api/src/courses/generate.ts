import type { Prayer, TimeAnchor } from '@prisma/client';
import { addDays, weekdayOf, zonedToUtc } from '../common/zoned-time';
import {
  computePrayerInstants,
  type PrayerKey,
  type PrayerSettings,
} from '../prayer-times/compute';

export type RuleInput = {
  id: string;
  weekday: number;
  startAnchor: TimeAnchor;
  startTime: string | null;
  startPrayer: Prayer | null;
  startOffsetMin: number;
  endAnchor: TimeAnchor;
  endTime: string | null;
  endPrayer: Prayer | null;
  endOffsetMin: number;
  effectiveFrom: string;
  effectiveTo: string | null;
};

export type GenerateInput = {
  settings: PrayerSettings;
  course: { startDate: string | null; endDate: string | null };
  rules: RuleInput[];
  pauses: { fromDate: string; toDate: string }[];
  from: string;
  to: string;
};

export type GeneratedSession = {
  date: string;
  startsAt: Date;
  endsAt: Date;
  scheduleId: string;
};

type Point = {
  anchor: TimeAnchor;
  time: string | null;
  prayer: Prayer | null;
  offsetMin: number;
};

/**
 * Pure: weekly rules → concrete sessions for [from, to] (mosque calendar dates, inclusive).
 * Skips dates outside the course dates, a rule's effective range, or a pause (decision 4.9).
 * Prayer anchors resolve against that day's prayer times, so "from Asr" drifts with the season.
 * A rule whose end is not after its start on a given day (e.g. "Maghrib to 18:00" in summer)
 * produces nothing that day.
 */
export function generateSessions(input: GenerateInput): GeneratedSession[] {
  const out: GeneratedSession[] = [];
  const { settings, course } = input;
  for (let date = input.from; date <= input.to; date = addDays(date, 1)) {
    if (course.startDate && date < course.startDate) continue;
    if (course.endDate && date > course.endDate) continue;
    if (input.pauses.some((p) => p.fromDate <= date && date <= p.toDate))
      continue;

    const weekday = weekdayOf(date);
    const rules = input.rules.filter(
      (r) =>
        r.weekday === weekday &&
        r.effectiveFrom <= date &&
        (!r.effectiveTo || date <= r.effectiveTo),
    );
    if (!rules.length) continue;

    let prayers: Record<PrayerKey, Date> | undefined;
    const resolve = (point: Point): Date => {
      if (point.anchor === 'FIXED')
        return zonedToUtc(date, point.time ?? '00:00', settings.timezone);
      prayers ??= computePrayerInstants(settings, date);
      const base = prayers[(point.prayer ?? 'FAJR').toLowerCase() as PrayerKey];
      return new Date(base.getTime() + point.offsetMin * 60_000);
    };

    for (const rule of rules) {
      const startsAt = resolve({
        anchor: rule.startAnchor,
        time: rule.startTime,
        prayer: rule.startPrayer,
        offsetMin: rule.startOffsetMin,
      });
      const endsAt = resolve({
        anchor: rule.endAnchor,
        time: rule.endTime,
        prayer: rule.endPrayer,
        offsetMin: rule.endOffsetMin,
      });
      if (endsAt > startsAt)
        out.push({ date, startsAt, endsAt, scheduleId: rule.id });
    }
  }
  return out;
}
