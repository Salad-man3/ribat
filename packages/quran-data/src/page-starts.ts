import rawPageStarts from './data/page-starts.json';
import type { AyahRef } from './types.js';

/** First ayah on each of the 604 Madinah mushaf pages (1-indexed pages). */
export const PAGE_STARTS: AyahRef[] = (rawPageStarts as [number, number][]).map(
  ([surah, ayah]) => ({ surah, ayah }),
);
