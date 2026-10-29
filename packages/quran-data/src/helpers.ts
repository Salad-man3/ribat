import { JUZ_STARTS } from './juz-starts.js';
import { PAGE_STARTS } from './page-starts.js';
import { SURAH_BY_NUMBER } from './surahs.js';
import type { AyahRange, AyahRef, PageRange } from './types.js';

export function compareAyah(a: AyahRef, b: AyahRef): number {
  if (a.surah !== b.surah) return a.surah - b.surah;
  return a.ayah - b.ayah;
}

function isValidAyah(ref: AyahRef): boolean {
  const surah = SURAH_BY_NUMBER.get(ref.surah);
  if (!surah) return false;
  return ref.ayah >= 1 && ref.ayah <= surah.ayahCount;
}

/** Maps an ayah to its mushaf page (1–604). */
export function pageForAyah(ref: AyahRef): number {
  let page = 1;
  for (let i = PAGE_STARTS.length - 1; i >= 0; i--) {
    if (compareAyah(PAGE_STARTS[i], ref) <= 0) {
      page = i + 1;
      break;
    }
  }
  return page;
}

export function pagesForRange(range: AyahRange): PageRange {
  return {
    from: pageForAyah(range.start),
    to: pageForAyah(range.end),
  };
}

export function validateRange(range: AyahRange): boolean {
  if (!isValidAyah(range.start) || !isValidAyah(range.end)) return false;
  return compareAyah(range.start, range.end) <= 0;
}

export function mergeRanges(ranges: AyahRange[]): AyahRange[] {
  const valid = ranges.filter(validateRange).sort((a, b) => compareAyah(a.start, b.start));
  const merged: AyahRange[] = [];

  for (const range of valid) {
    const last = merged.at(-1);
    if (!last) {
      merged.push({ ...range });
      continue;
    }

    const adjacentOrOverlap = compareAyah(range.start, last.end) <= 0;
    if (adjacentOrOverlap && compareAyah(range.end, last.end) > 0) {
      last.end = { ...range.end };
    } else if (!adjacentOrOverlap) {
      merged.push({ ...range });
    }
  }

  return merged;
}

/** Ayahs in an inclusive range, across surah boundaries. Assumes a valid range. */
export function ayahsInRange(range: AyahRange): number {
  const { start, end } = range;
  if (start.surah === end.surah) return end.ayah - start.ayah + 1;
  let count = SURAH_BY_NUMBER.get(start.surah)!.ayahCount - start.ayah + 1;
  for (let s = start.surah + 1; s < end.surah; s++) count += SURAH_BY_NUMBER.get(s)!.ayahCount;
  return count + end.ayah;
}

function ayahBefore(ref: AyahRef): AyahRef {
  if (ref.ayah > 1) return { surah: ref.surah, ayah: ref.ayah - 1 };
  const prev = ref.surah - 1;
  return { surah: prev, ayah: SURAH_BY_NUMBER.get(prev)!.ayahCount };
}

/** Last ayah printed on a mushaf page (1–604). */
export function lastAyahOnPage(page: number): AyahRef | null {
  if (page < 1 || page > PAGE_STARTS.length) return null;
  if (page === PAGE_STARTS.length) return { surah: 114, ayah: 6 };
  return ayahBefore(PAGE_STARTS[page]);
}

/** Inclusive page span → ayah range on the Madinah mushaf. */
export function rangeForPages(pageFrom: number, pageTo: number): AyahRange | null {
  if (pageFrom < 1 || pageTo > PAGE_STARTS.length || pageFrom > pageTo) return null;
  const end = lastAyahOnPage(pageTo);
  if (!end) return null;
  return { start: { ...PAGE_STARTS[pageFrom - 1] }, end };
}

/** Juz number (1–30) containing this ayah. */
export function juzForAyah(ref: AyahRef): number | null {
  if (!isValidAyah(ref)) return null;
  let juz = 1;
  for (let i = JUZ_STARTS.length - 1; i >= 0; i--) {
    if (compareAyah(JUZ_STARTS[i], ref) <= 0) {
      juz = i + 1;
      break;
    }
  }
  return juz;
}

/** Full ayah span of one juz. */
export function rangeForJuz(juz: number): AyahRange | null {
  if (juz < 1 || juz > JUZ_STARTS.length) return null;
  const start = { ...JUZ_STARTS[juz - 1] };
  const end =
    juz === JUZ_STARTS.length
      ? ({ surah: 114, ayah: 6 } satisfies AyahRef)
      : ayahBefore(JUZ_STARTS[juz]);
  return { start, end };
}

function clampAyah(ref: AyahRef, floor: AyahRef, ceiling: AyahRef): AyahRef {
  if (compareAyah(ref, floor) < 0) return { ...floor };
  if (compareAyah(ref, ceiling) > 0) return { ...ceiling };
  return { ...ref };
}

/**
 * Page range clipped to one surah → ayah range (for "pages within surah" logging).
 */
export function pagesOverlappingSurah(
  surah: number,
  pageFrom: number,
  pageTo: number,
): AyahRange | null {
  const meta = SURAH_BY_NUMBER.get(surah);
  if (!meta) return null;
  const surahStart = { surah, ayah: 1 };
  const surahEnd = { surah, ayah: meta.ayahCount };
  const surahPageFrom = pageForAyah(surahStart);
  const surahPageTo = pageForAyah(surahEnd);
  const from = Math.max(pageFrom, surahPageFrom);
  const to = Math.min(pageTo, surahPageTo);
  if (from > to) return null;
  const span = rangeForPages(from, to);
  if (!span) return null;
  const start = clampAyah(span.start, surahStart, surahEnd);
  const end = clampAyah(span.end, surahStart, surahEnd);
  if (compareAyah(start, end) > 0) return null;
  return { start, end };
}
