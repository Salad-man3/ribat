import { describe, expect, it } from 'vitest';
import {
  applyHifzShortcut,
  continuationRangeFromPosition,
  mergeStartManual,
  pickEndWithUnit,
  setEndManual,
  stepEndByPage,
  stepEndBySurah,
} from './hifz-range-shortcuts';

describe('continuationRangeFromPosition', () => {
  it('extends through the end of the start page', () => {
    const next = continuationRangeFromPosition({ lastSurah: 1, lastAyah: 3 });
    expect(next.surahStart).toBe(1);
    expect(next.ayahStart).toBe(4);
    expect(next.ayahEnd).toBe(7);
  });
});

describe('pickEndWithUnit', () => {
  it('keeps the start and sets the end to the unit', () => {
    const current = continuationRangeFromPosition({ lastSurah: 78, lastAyah: 0 });
    const next = pickEndWithUnit('PAGE', 582, current);
    expect(next?.surahStart).toBe(current.surahStart);
    expect(next?.ayahStart).toBe(current.ayahStart);
    expect(next!.ayahEnd).toBeGreaterThanOrEqual(next!.ayahStart);
  });
});

describe('shortcuts and steppers', () => {
  const base = {
    surahStart: 78,
    ayahStart: 1,
    surahEnd: 78,
    ayahEnd: 1,
  };

  it('extends to end of page', () => {
    const next = applyHifzShortcut('endOfPage', base);
    expect(next!.ayahEnd).toBeGreaterThan(1);
    expect(next!.surahEnd).toBe(78);
  });

  it('steps the end by surah', () => {
    const next = stepEndBySurah(base, 1);
    expect(next).toEqual({
      surahStart: 78,
      ayahStart: 1,
      surahEnd: 79,
      ayahEnd: 46,
    });
  });

  it('steps the end by page', () => {
    const onPage582 = {
      surahStart: 78,
      ayahStart: 1,
      surahEnd: 78,
      ayahEnd: 1,
    };
    const next = stepEndByPage(onPage582, 1);
    expect(next!.surahEnd).toBeGreaterThanOrEqual(78);
  });
});

describe('manual from/to', () => {
  it('pulls the end forward when the start moves past it', () => {
    expect(
      mergeStartManual(
        { surahStart: 1, ayahStart: 1, surahEnd: 1, ayahEnd: 5 },
        { surah: 1, ayah: 7 },
      ),
    ).toEqual({
      surahStart: 1,
      ayahStart: 7,
      surahEnd: 1,
      ayahEnd: 7,
    });
  });

  it('rejects an end before the start', () => {
    expect(
      setEndManual(
        { surahStart: 2, ayahStart: 1, surahEnd: 2, ayahEnd: 5 },
        { surah: 1, ayah: 7 },
      ),
    ).toBeNull();
  });
});
