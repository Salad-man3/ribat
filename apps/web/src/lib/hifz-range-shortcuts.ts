import {
  ayahsInRange,
  compareAyah,
  lastAyahOnPage,
  pageForAyah,
  pagesForRange,
  rangeForJuz,
  rangeForPages,
  SURAH_BY_NUMBER,
  validateRange,
} from '@ribat/quran-data';
import type { AyahRangeInput } from '@ribat/shared';

export type AyahRangeState = {
  surahStart: number;
  ayahStart: number;
  surahEnd: number;
  ayahEnd: number;
};

export type PickUnit = 'JUZ' | 'SURAH' | 'PAGE';

export type HifzRangeShortcut = 'endOfPage' | 'endOfSurah';

export const HIFZ_PICK_UNIT_KEY = 'ribat-hifz-pick-unit';

function spanToState(span: {
  start: { surah: number; ayah: number };
  end: { surah: number; ayah: number };
}): AyahRangeState {
  return {
    surahStart: span.start.surah,
    ayahStart: span.start.ayah,
    surahEnd: span.end.surah,
    ayahEnd: span.end.ayah,
  };
}

function stateToSpan(range: AyahRangeState) {
  return {
    start: { surah: range.surahStart, ayah: range.ayahStart },
    end: { surah: range.surahEnd, ayah: range.ayahEnd },
  };
}

export function startRangeFromPosition(position?: {
  lastSurah?: number | null;
  lastAyah?: number | null;
}): AyahRangeState {
  const startSurah = position?.lastSurah ?? 1;
  const lastAyah = position?.lastAyah ?? 0;
  const max = SURAH_BY_NUMBER.get(startSurah)?.ayahCount ?? 1;
  const startAyah = Math.min(lastAyah + 1, max);
  return {
    surahStart: startSurah,
    ayahStart: startAyah,
    surahEnd: startSurah,
    ayahEnd: startAyah,
  };
}

/** Next ayah after the last counted position through the end of that mushaf page. */
export function continuationRangeFromPosition(position?: {
  lastSurah?: number | null;
  lastAyah?: number | null;
}): AyahRangeState {
  const start = startRangeFromPosition(position);
  const startRef = { surah: start.surahStart, ayah: start.ayahStart };
  const end = lastAyahOnPage(pageForAyah(startRef));
  if (!end || !validateRange({ start: startRef, end })) return start;
  return {
    surahStart: start.surahStart,
    ayahStart: start.ayahStart,
    surahEnd: end.surah,
    ayahEnd: end.ayah,
  };
}

/** Full ayah span for one page, surah, or juz (picker values). */
export function spanForPickUnit(unit: PickUnit, value: number) {
  if (unit === 'PAGE') return rangeForPages(value, value);
  if (unit === 'JUZ') return rangeForJuz(value);
  const meta = SURAH_BY_NUMBER.get(value);
  if (!meta) return null;
  return {
    start: { surah: value, ayah: 1 },
    end: { surah: value, ayah: meta.ayahCount },
  };
}

/** Unit picker adjusts the end only; the start stays on آخر موضع. */
export function pickEndWithUnit(
  unit: PickUnit,
  value: number,
  current: AyahRangeState,
): AyahRangeState | null {
  const span = spanForPickUnit(unit, value);
  if (!span) return null;
  const start = { surah: current.surahStart, ayah: current.ayahStart };
  let end = span.end;
  if (compareAyah(end, start) < 0) end = { ...start };
  const next = spanToState({ start, end });
  return isValidAyahRangeState(next) ? next : null;
}

/** Edit the from side by surah/ayah; does not snap to a whole unit. */
export function mergeStartManual(
  range: AyahRangeState,
  start: { surah: number; ayah: number },
): AyahRangeState {
  let end = { surah: range.surahEnd, ayah: range.ayahEnd };
  if (compareAyah(end, start) < 0) end = { ...start };
  return {
    surahStart: start.surah,
    ayahStart: start.ayah,
    surahEnd: end.surah,
    ayahEnd: end.ayah,
  };
}

export function setEndManual(
  range: AyahRangeState,
  end: { surah: number; ayah: number },
): AyahRangeState | null {
  const start = { surah: range.surahStart, ayah: range.ayahStart };
  if (compareAyah(end, start) < 0) return null;
  if (
    !validateRange({
      start,
      end,
    })
  )
    return null;
  return {
    surahStart: range.surahStart,
    ayahStart: range.ayahStart,
    surahEnd: end.surah,
    ayahEnd: end.ayah,
  };
}

export function applyHifzShortcut(
  shortcut: HifzRangeShortcut,
  range: AyahRangeState,
): AyahRangeState | null {
  const startRef = { surah: range.surahStart, ayah: range.ayahStart };

  switch (shortcut) {
    case 'endOfPage': {
      const page = pageForAyah(startRef);
      const end = lastAyahOnPage(page);
      if (!end) return null;
      const next = { ...range, surahEnd: end.surah, ayahEnd: end.ayah };
      return isValidAyahRangeState(next) ? next : null;
    }
    case 'endOfSurah': {
      const meta = SURAH_BY_NUMBER.get(range.surahStart);
      if (!meta) return null;
      const next = {
        ...range,
        surahEnd: range.surahStart,
        ayahEnd: meta.ayahCount,
      };
      return isValidAyahRangeState(next) ? next : null;
    }
  }
}

export function stepEndByPage(range: AyahRangeState, delta: number): AyahRangeState | null {
  const startRef = { surah: range.surahStart, ayah: range.ayahStart };
  const endPage = pageForAyah({ surah: range.surahEnd, ayah: range.ayahEnd });
  const targetPage = Math.min(604, Math.max(1, endPage + delta));
  const startPage = pageForAyah(startRef);
  const page = Math.max(targetPage, startPage);
  const end = lastAyahOnPage(page);
  if (!end) return null;
  const next = { ...range, surahEnd: end.surah, ayahEnd: end.ayah };
  return isValidAyahRangeState(next) ? next : null;
}

export function stepEndBySurah(range: AyahRangeState, delta: number): AyahRangeState | null {
  let surah = range.surahEnd + delta;
  if (surah < 1 || surah > 114) return null;
  if (surah < range.surahStart) surah = range.surahStart;
  const meta = SURAH_BY_NUMBER.get(surah);
  if (!meta) return null;
  let ayahEnd = meta.ayahCount;
  if (surah === range.surahStart) ayahEnd = Math.max(ayahEnd, range.ayahStart);
  const next = { ...range, surahEnd: surah, ayahEnd };
  return isValidAyahRangeState(next) ? next : null;
}

export function rangeStats(range: AyahRangeState): { pages: number; ayahs: number } | null {
  const span = stateToSpan(range);
  if (!validateRange(span)) return null;
  const { from, to } = pagesForRange(span);
  return { pages: to - from + 1, ayahs: ayahsInRange(span) };
}

export function toAyahRangeInput(range: AyahRangeState): AyahRangeInput {
  return {
    surahStart: range.surahStart,
    ayahStart: range.ayahStart,
    surahEnd: range.surahEnd,
    ayahEnd: range.ayahEnd,
  };
}

export function isValidAyahRangeState(range: AyahRangeState): boolean {
  return validateRange(stateToSpan(range));
}

export function readStoredPickUnit(): PickUnit {
  try {
    const v = localStorage.getItem(HIFZ_PICK_UNIT_KEY);
    if (v === 'JUZ' || v === 'SURAH' || v === 'PAGE') return v;
  } catch {
    /* private mode */
  }
  return 'PAGE';
}

export function storePickUnit(unit: PickUnit) {
  try {
    localStorage.setItem(HIFZ_PICK_UNIT_KEY, unit);
  } catch {
    /* private mode */
  }
}
