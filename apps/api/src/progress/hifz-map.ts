import { pagesForRange, rangeForJuz } from '@ribat/quran-data';
import type { MemorizationLog, MemorizationTest } from '@prisma/client';

type CoverageLog = Pick<
  MemorizationLog,
  | 'type'
  | 'voidedAt'
  | 'surahStart'
  | 'ayahStart'
  | 'surahEnd'
  | 'ayahEnd'
  | 'pageFrom'
  | 'pageTo'
  | 'countsProgress'
> & { loggedAt?: Date };

export type JuzFill = {
  juz: number;
  newPages: number;
  initialPages: number;
  totalPages: number;
  certified: boolean;
};

export type LastRecitation = {
  type: MemorizationLog['type'];
  pageFrom: number;
  pageTo: number;
  surahStart: number | null;
  ayahStart: number | null;
  surahEnd: number | null;
  ayahEnd: number | null;
  loggedAt: string;
};

export type HifzMapSnapshot = {
  juzMemorized: number[];
  juzFills: JuzFill[];
  juzTests: {
    juz: number;
    passed: boolean;
    score: number;
    attemptNo: number;
  }[];
  lastLog: LastRecitation | null;
};

function pagesOf(logs: CoverageLog[], type: 'NEW' | 'INITIAL'): Set<number> {
  const pages = new Set<number>();
  for (const l of logs) {
    if (l.voidedAt || l.type !== type || !l.countsProgress) continue;
    for (let p = l.pageFrom; p <= l.pageTo; p++) pages.add(p);
  }
  return pages;
}

function juzPageSpan(juz: number): { from: number; to: number } | null {
  const range = rangeForJuz(juz);
  if (!range) return null;
  return pagesForRange({
    start: { surah: range.start.surah, ayah: range.start.ayah },
    end: { surah: range.end.surah, ayah: range.end.ayah },
  });
}

/** Latest juz test per juz, page fill, and the latest recitation. */
export function hifzMapFromData(
  logs: CoverageLog[],
  tests: Pick<
    MemorizationTest,
    'juz' | 'passed' | 'score' | 'attemptNo' | 'takenAt' | 'scopeType'
  >[],
): HifzMapSnapshot {
  const mosque = pagesOf(logs, 'NEW');
  const prior = pagesOf(logs, 'INITIAL');
  const covered = new Set<number>([...mosque, ...prior]);

  const byJuz = new Map<number, (typeof tests)[number]>();
  for (const t of tests) {
    if (t.scopeType !== 'JUZ' || t.juz == null) continue;
    const prev = byJuz.get(t.juz);
    if (!prev || t.takenAt > prev.takenAt) byJuz.set(t.juz, t);
  }

  const juzMemorized: number[] = [];
  const juzFills: JuzFill[] = [];
  for (let juz = 1; juz <= 30; juz++) {
    const span = juzPageSpan(juz);
    if (!span) continue;
    let newPages = 0;
    let initialPages = 0;
    let known = 0;
    for (let p = span.from; p <= span.to; p++) {
      if (mosque.has(p)) newPages++;
      else if (prior.has(p)) initialPages++;
      if (covered.has(p)) known++;
    }
    const totalPages = span.to - span.from + 1;
    if (known === totalPages) juzMemorized.push(juz);
    juzFills.push({
      juz,
      newPages,
      initialPages,
      totalPages,
      certified: byJuz.get(juz)?.passed === true,
    });
  }

  const juzTests = [...byJuz.entries()]
    .sort(([a], [b]) => a - b)
    .map(([juz, t]) => ({
      juz,
      passed: t.passed,
      score: t.score,
      attemptNo: t.attemptNo,
    }));

  let last: CoverageLog | null = null;
  for (const l of logs) {
    if (l.voidedAt || !l.loggedAt) continue;
    if (!last?.loggedAt || l.loggedAt > last.loggedAt) last = l;
  }

  return {
    juzMemorized,
    juzFills,
    juzTests,
    lastLog: last?.loggedAt
      ? {
          type: last.type,
          pageFrom: last.pageFrom,
          pageTo: last.pageTo,
          surahStart: last.surahStart,
          ayahStart: last.ayahStart,
          surahEnd: last.surahEnd,
          ayahEnd: last.ayahEnd,
          loggedAt: last.loggedAt.toISOString(),
        }
      : null,
  };
}
