import rawSurahs from './data/surahs.json';
import type { Surah } from './types.js';

type RawSurah = [number, string, string, number];

export const SURAHs: Surah[] = (rawSurahs as RawSurah[]).map(
  ([number, nameAr, nameEn, ayahCount]) => ({
    number,
    nameAr,
    nameEn,
    ayahCount,
  }),
);

export const SURAH_BY_NUMBER = new Map(SURAHs.map((s) => [s.number, s]));
