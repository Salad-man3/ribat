import { hifzMapFromData } from './hifz-map';

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
    const map = hifzMapFromData([], [
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
    ]);
    expect(map.juzTests).toEqual([
      { juz: 30, passed: true, score: 85, attemptNo: 2 },
    ]);
  });
});
