import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ayahsInRange,
  juzForAyah,
  mergeRanges,
  pageForAyah,
  pagesForRange,
  pagesOverlappingSurah,
  rangeForJuz,
  rangeForPages,
  validateRange,
} from './helpers.js';
import { JUZ_STARTS } from './juz-starts.js';
import { PAGE_STARTS } from './page-starts.js';

describe('quran-data helpers', () => {
  it('has 604 page starts', () => {
    assert.equal(PAGE_STARTS.length, 604);
    assert.deepEqual(PAGE_STARTS[0], { surah: 1, ayah: 1 });
    assert.deepEqual(PAGE_STARTS[1], { surah: 2, ayah: 1 });
  });

  it('maps known ayahs to pages', () => {
    assert.equal(pageForAyah({ surah: 1, ayah: 1 }), 1);
    assert.equal(pageForAyah({ surah: 2, ayah: 1 }), 2);
    assert.equal(pageForAyah({ surah: 112, ayah: 1 }), 604);
  });

  it('pagesForRange returns inclusive page span', () => {
    assert.deepEqual(
      pagesForRange({ start: { surah: 1, ayah: 1 }, end: { surah: 1, ayah: 7 } }),
      { from: 1, to: 1 },
    );
    assert.deepEqual(
      pagesForRange({ start: { surah: 1, ayah: 1 }, end: { surah: 2, ayah: 5 } }),
      { from: 1, to: 2 },
    );
  });

  it('validateRange rejects invalid ayahs and reversed ranges', () => {
    assert.equal(
      validateRange({ start: { surah: 1, ayah: 1 }, end: { surah: 1, ayah: 7 } }),
      true,
    );
    assert.equal(
      validateRange({ start: { surah: 1, ayah: 7 }, end: { surah: 1, ayah: 1 } }),
      false,
    );
    assert.equal(
      validateRange({ start: { surah: 999, ayah: 1 }, end: { surah: 1, ayah: 1 } }),
      false,
    );
  });

  it('mergeRanges combines overlapping ranges', () => {
    assert.deepEqual(
      mergeRanges([
        { start: { surah: 1, ayah: 1 }, end: { surah: 1, ayah: 3 } },
        { start: { surah: 1, ayah: 3 }, end: { surah: 1, ayah: 7 } },
        { start: { surah: 2, ayah: 1 }, end: { surah: 2, ayah: 5 } },
      ]),
      [
        { start: { surah: 1, ayah: 1 }, end: { surah: 1, ayah: 7 } },
        { start: { surah: 2, ayah: 1 }, end: { surah: 2, ayah: 5 } },
      ],
    );
  });

  it('ayahsInRange counts across surah boundaries', () => {
    assert.equal(ayahsInRange({ start: { surah: 1, ayah: 1 }, end: { surah: 1, ayah: 7 } }), 7);
    // Al-Fatiha (7) + Al-Baqarah 1–5
    assert.equal(ayahsInRange({ start: { surah: 1, ayah: 1 }, end: { surah: 2, ayah: 5 } }), 12);
    // An-Naba 1 to An-Nas 6: the whole of juz 30 = 564 ayahs
    assert.equal(ayahsInRange({ start: { surah: 78, ayah: 1 }, end: { surah: 114, ayah: 6 } }), 564);
  });

  it('has 30 juz starts', () => {
    assert.equal(JUZ_STARTS.length, 30);
    assert.deepEqual(JUZ_STARTS[0], { surah: 1, ayah: 1 });
    assert.deepEqual(JUZ_STARTS[29], { surah: 78, ayah: 1 });
  });

  it('juzForAyah maps known ayahs', () => {
    assert.equal(juzForAyah({ surah: 1, ayah: 1 }), 1);
    assert.equal(juzForAyah({ surah: 2, ayah: 141 }), 1);
    assert.equal(juzForAyah({ surah: 2, ayah: 142 }), 2);
    assert.equal(juzForAyah({ surah: 114, ayah: 6 }), 30);
  });

  it('rangeForPages round-trips with pagesForRange on page 1', () => {
    const range = rangeForPages(1, 1);
    assert.ok(range);
    assert.deepEqual(pagesForRange(range!), { from: 1, to: 1 });
  });

  it('rangeForJuz 30 matches juz start', () => {
    const range = rangeForJuz(30);
    assert.ok(range);
    assert.deepEqual(range!.start, JUZ_STARTS[29]);
    assert.deepEqual(range!.end, { surah: 114, ayah: 6 });
  });

  it('pagesOverlappingSurah clips to surah', () => {
    const range = pagesOverlappingSurah(1, 1, 2);
    assert.ok(range);
    assert.equal(range!.start.surah, 1);
    assert.equal(range!.end.surah, 1);
    assert.equal(range!.end.ayah, 7);
  });
});
