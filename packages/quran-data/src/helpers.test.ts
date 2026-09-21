import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  mergeRanges,
  pageForAyah,
  pagesForRange,
  validateRange,
} from './helpers.js';
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
});
