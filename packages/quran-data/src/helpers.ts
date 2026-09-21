import { PAGE_STARTS } from './page-starts.js';
import { SURAH_BY_NUMBER } from './surahs.js';
import type { AyahRange, AyahRef, PageRange } from './types.js';

function compareAyah(a: AyahRef, b: AyahRef): number {
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
