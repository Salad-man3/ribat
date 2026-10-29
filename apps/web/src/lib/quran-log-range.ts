import {
  pagesOverlappingSurah,
  rangeForPages,
  validateRange,
} from '@ribat/quran-data';
import type { AyahRangeInput } from '@ribat/shared';

export type QuranRangeMode = 'AYAH' | 'PAGE' | 'SURAH_PAGE';

export function toAyahRangeInput(range: {
  start: { surah: number; ayah: number };
  end: { surah: number; ayah: number };
}): AyahRangeInput {
  return {
    surahStart: range.start.surah,
    ayahStart: range.start.ayah,
    surahEnd: range.end.surah,
    ayahEnd: range.end.ayah,
  };
}

/** Turn the teacher's picker into the ayah range the API stores. */
export function resolveQuranLogRange(
  mode: QuranRangeMode,
  ayah: AyahRangeInput,
  pages: { pageFrom: number; pageTo: number },
  surahPages: { surah: number; pageFrom: number; pageTo: number },
): AyahRangeInput | null {
  if (mode === 'AYAH') {
    const ok = validateRange({
      start: { surah: ayah.surahStart, ayah: ayah.ayahStart },
      end: { surah: ayah.surahEnd, ayah: ayah.ayahEnd },
    });
    return ok ? ayah : null;
  }
  if (mode === 'PAGE') {
    const span = rangeForPages(pages.pageFrom, pages.pageTo);
    return span ? toAyahRangeInput(span) : null;
  }
  const span = pagesOverlappingSurah(
    surahPages.surah,
    surahPages.pageFrom,
    surahPages.pageTo,
  );
  return span ? toAyahRangeInput(span) : null;
}
