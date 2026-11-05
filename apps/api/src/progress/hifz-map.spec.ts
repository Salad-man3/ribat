import { pagesForRange, rangeForJuz } from '@ribat/quran-data';
import { hifzMapFromData } from './hifz-map';

const juz30 = pagesForRange(rangeForJuz(30)!);
const log = (
  type: 'NEW' | 'INITIAL',
  pageFrom: number,
  pageTo: number,
  countsProgress = true,
) => ({
  type,
  voidedAt: null,
  surahStart: 78,
  ayahStart: 1,
  surahEnd: 114,
  ayahEnd: 6,
  pageFrom,
  pageTo,
  countsProgress,
});

describe('hifzMapFromData', () => {
  it('marks juz 30 when juz 30 pages are logged as NEW', () => {
    const map = hifzMapFromData(
      [
        {
          type: 'NEW',
          voidedAt: null,
          surahStart: 78,
          ayahStart: 1,
          surahEnd: 114,
          ayahEnd: 6,
          pageFrom: 582,
          pageTo: 604,
          countsProgress: true,
        },
      ],
      [],
    );
    expect(map.juzMemorized).toContain(30);
  });

  it('ignores logs that do not count toward progress', () => {
    const map = hifzMapFromData(
      [
        {
          type: 'NEW',
          voidedAt: null,
          surahStart: 78,
          ayahStart: 1,
          surahEnd: 114,
          ayahEnd: 6,
          pageFrom: 582,
          pageTo: 604,
          countsProgress: false,
        },
      ],
      [],
    );
    expect(map.juzMemorized).not.toContain(30);
  });

  it('uses the latest test per juz', () => {
    const map = hifzMapFromData(
      [],
      [
        {
          scopeType: 'JUZ',
          juz: 30,
          passed: false,
          score: 50,
          attemptNo: 1,
          takenAt: new Date('2026-01-01'),
        },
        {
          scopeType: 'JUZ',
          juz: 30,
          passed: true,
          score: 85,
          attemptNo: 2,
          takenAt: new Date('2026-02-01'),
        },
      ],
    );
    expect(map.juzTests).toEqual([
      { juz: 30, passed: true, score: 85, attemptNo: 2 },
    ]);
  });

  it('fills a juz from pages: green for new, gray for prior, gold only when the latest test passed', () => {
    const partial = hifzMapFromData([log('NEW', juz30.from, juz30.from)], []);
    expect(partial.juzFills.find((j) => j.juz === 30)).toMatchObject({
      newPages: 1,
      initialPages: 0,
      certified: false,
    });
    expect(partial.juzMemorized).not.toContain(30);

    const prior = hifzMapFromData([log('INITIAL', juz30.from, juz30.to)], []);
    const gray = prior.juzFills.find((j) => j.juz === 30)!;
    expect(gray.initialPages).toBe(gray.totalPages);
    expect(gray.newPages).toBe(0);
    expect(prior.juzMemorized).toContain(30);

    const overlap = hifzMapFromData(
      [
        log('INITIAL', juz30.from, juz30.to),
        log('NEW', juz30.from, juz30.from),
      ],
      [],
    );
    expect(overlap.juzFills.find((j) => j.juz === 30)).toMatchObject({
      newPages: 1,
      initialPages: gray.totalPages - 1,
    });

    const gold = hifzMapFromData(
      [log('NEW', juz30.from, juz30.to)],
      [
        {
          scopeType: 'JUZ',
          juz: 30,
          passed: true,
          score: 90,
          attemptNo: 1,
          takenAt: new Date('2026-03-01'),
        },
      ],
    );
    expect(gold.juzFills.find((j) => j.juz === 30)?.certified).toBe(true);

    const failed = hifzMapFromData(
      [],
      [
        {
          scopeType: 'JUZ',
          juz: 30,
          passed: false,
          score: 40,
          attemptNo: 1,
          takenAt: new Date('2026-03-01'),
        },
      ],
    );
    expect(failed.juzFills.find((j) => j.juz === 30)?.certified).toBe(false);
  });

  it('keeps the latest recitation', () => {
    const map = hifzMapFromData(
      [
        {
          ...log('NEW', juz30.from, juz30.from),
          loggedAt: new Date('2026-01-01T10:00:00Z'),
        },
        {
          ...log('NEW', juz30.from, juz30.from + 1),
          type: 'REVISION',
          loggedAt: new Date('2026-02-01T10:00:00Z'),
        },
      ],
      [],
    );
    expect(map.lastLog?.loggedAt).toBe('2026-02-01T10:00:00.000Z');
    expect(map.lastLog?.type).toBe('REVISION');
  });
});
