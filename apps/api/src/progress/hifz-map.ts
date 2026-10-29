import { mergeRanges, pagesForRange, rangeForJuz } from '@ribat/quran-data';
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
>;

export type HifzMapSnapshot = {
  juzMemorized: number[];
  juzTests: {
    juz: number;
    passed: boolean;
    score: number;
    attemptNo: number;
  }[];
};

function memorizedPages(logs: CoverageLog[]): Set<number> {
  const pages = new Set<number>();
  for (const l of logs) {
    if (l.voidedAt) continue;
    if (l.type !== 'NEW' && l.type !== 'INITIAL') continue;
    if (!l.countsProgress) continue;
    for (let p = l.pageFrom; p <= l.pageTo; p++) pages.add(p);
  }
  return pages;
}

function juzFullyCovered(juz: number, pages: Set<number>): boolean {
  const range = rangeForJuz(juz);
  if (!range) return false;
  const span = pagesForRange({
    start: { surah: range.start.surah, ayah: range.start.ayah },
    end: { surah: range.end.surah, ayah: range.end.ayah },
  });
  for (let p = span.from; p <= span.to; p++) if (!pages.has(p)) return false;
  return true;
}

/** Latest juz test per juz (mosque in-class tests). */
export function hifzMapFromData(
  logs: CoverageLog[],
  tests: Pick<
    MemorizationTest,
    'juz' | 'passed' | 'score' | 'attemptNo' | 'takenAt' | 'scopeType'
  >[],
): HifzMapSnapshot {
  const pages = memorizedPages(logs);
  const juzMemorized: number[] = [];
  for (let j = 1; j <= 30; j++) if (juzFullyCovered(j, pages)) juzMemorized.push(j);

  const byJuz = new Map<number, (typeof tests)[number]>();
  for (const t of tests) {
    if (t.scopeType !== 'JUZ' || t.juz == null) continue;
    const prev = byJuz.get(t.juz);
    if (!prev || t.takenAt > prev.takenAt) byJuz.set(t.juz, t);
  }
  const juzTests = [...byJuz.entries()]
    .sort(([a], [b]) => a - b)
    .map(([juz, t]) => ({
      juz,
      passed: t.passed,
      score: t.score,
      attemptNo: t.attemptNo,
    }));

  return { juzMemorized, juzTests };
}

/** Merged ayah ranges for display (optional). */
export function coverageRanges(logs: CoverageLog[]) {
  const ranges = logs
    .filter(
      (l) =>
        !l.voidedAt &&
        (l.type === 'NEW' || l.type === 'INITIAL') &&
        l.countsProgress,
    )
    .filter((l) => l.surahStart !== null)
    .map((l) => ({
      start: { surah: l.surahStart!, ayah: l.ayahStart! },
      end: { surah: l.surahEnd!, ayah: l.ayahEnd! },
    }));
  return mergeRanges(ranges);
}
