import { describe, expect, it } from 'vitest';
import { resolveQuranLogRange } from './quran-log-range';

describe('resolveQuranLogRange', () => {
  it('accepts a valid ayah range', () => {
    const range = resolveQuranLogRange(
      'AYAH',
      { surahStart: 1, ayahStart: 1, surahEnd: 1, ayahEnd: 7 },
      { pageFrom: 1, pageTo: 1 },
      { surah: 1, pageFrom: 1, pageTo: 1 },
    );
    expect(range?.surahEnd).toBe(1);
  });

  it('derives ayahs from pages', () => {
    const range = resolveQuranLogRange(
      'PAGE',
      { surahStart: 1, ayahStart: 1, surahEnd: 1, ayahEnd: 1 },
      { pageFrom: 1, pageTo: 1 },
      { surah: 1, pageFrom: 1, pageTo: 1 },
    );
    expect(range).toEqual({
      surahStart: 1,
      ayahStart: 1,
      surahEnd: 1,
      ayahEnd: 7,
    });
  });
});
