import { ayahsInRange, mergeRanges, type AyahRange } from '@ribat/quran-data';
import { dateIn, toDateString } from '../common/zoned-time';

/** 05-offline-sync §6: a device clock is trusted only this far from the server's. */
export const MAX_CLOCK_SKEW_MS = 12 * 60 * 60 * 1000;

/** The time a write is recorded at: the device's, unless it is implausible. */
export function clampCapturedAt(
  capturedAt: string | undefined,
  now: Date,
): { at: Date; skewed: boolean } {
  if (!capturedAt) return { at: now, skewed: false };
  const at = new Date(capturedAt);
  if (Math.abs(at.getTime() - now.getTime()) > MAX_CLOCK_SKEW_MS)
    return { at: now, skewed: true };
  return { at, skewed: false };
}

/**
 * PERM-04 matrix: a teacher marks and corrects attendance "own, same day". Same day is the
 * session's calendar date in the organization's timezone; a class that runs past midnight
 * stays writable until it ends, so the rollover does not lock a teacher out mid-class.
 */
export function teacherMayWriteSession(
  at: Date,
  session: { date: Date; endsAt: Date },
  timeZone: string,
): boolean {
  const day = dateIn(at, timeZone);
  const sessionDay = toDateString(session.date);
  if (day < sessionDay) return false;
  return day === sessionDay || at <= session.endsAt;
}

/** DM-09: the later `markedAt` wins; a tie goes to the write that arrives last. */
export function incomingAttendanceWins(
  existingMarkedAt: Date,
  incoming: Date,
): boolean {
  return incoming >= existingMarkedAt;
}

export type LedgerRow = {
  type: 'NEW' | 'REVISION' | 'INITIAL' | 'TEST';
  surahStart: number | null;
  ayahStart: number | null;
  surahEnd: number | null;
  ayahEnd: number | null;
  pageFrom: number;
  pageTo: number;
  loggedAt: Date;
};

export type Summary = {
  pagesMemorized: number;
  ayahsMemorized: number;
  lastPageReached: number | null;
  lastSurah: number | null;
  lastAyah: number | null;
  lastLoggedAt: Date | null;
};

/**
 * ADR-0005: progress is the union of memorized ranges, so order does not matter.
 * Only NEW and INITIAL logs add coverage; revisions and tests re-recite what is already there.
 * Callers pass non-voided logs only.
 */
export function summarize(logs: LedgerRow[]): Summary {
  const sorted = [...logs].sort(
    (a, b) => a.loggedAt.getTime() - b.loggedAt.getTime(),
  );
  const coverage = sorted.filter((l) => l.type === 'NEW' || l.type === 'INITIAL');

  const pages = new Set<number>();
  for (const l of coverage)
    for (let p = l.pageFrom; p <= l.pageTo; p++) pages.add(p);

  const ranges: AyahRange[] = coverage
    .filter((l) => l.surahStart !== null)
    .map((l) => ({
      start: { surah: l.surahStart!, ayah: l.ayahStart! },
      end: { surah: l.surahEnd!, ayah: l.ayahEnd! },
    }));
  const ayahs = mergeRanges(ranges).reduce((n, r) => n + ayahsInRange(r), 0);

  const last = coverage.at(-1);
  return {
    pagesMemorized: pages.size,
    ayahsMemorized: ayahs,
    lastPageReached: last?.pageTo ?? null,
    lastSurah: last?.surahEnd ?? null,
    lastAyah: last?.ayahEnd ?? null,
    lastLoggedAt: sorted.at(-1)?.loggedAt ?? null,
  };
}
