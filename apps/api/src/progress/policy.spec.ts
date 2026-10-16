import {
  clampCapturedAt,
  incomingAttendanceWins,
  summarize,
  teacherMayWriteSession,
  type LedgerRow,
} from './policy';

const TZ = 'Asia/Damascus'; // UTC+3

describe('clampCapturedAt', () => {
  const now = new Date('2026-10-15T12:00:00Z');

  it('trusts a device clock within 12 hours', () => {
    expect(clampCapturedAt('2026-10-15T08:00:00+03:00', now)).toEqual({
      at: new Date('2026-10-15T05:00:00Z'),
      skewed: false,
    });
  });

  it('replaces a clock a day off with the server time and flags it', () => {
    expect(clampCapturedAt('2026-10-14T11:00:00Z', now)).toEqual({
      at: now,
      skewed: true,
    });
    expect(clampCapturedAt('2026-10-16T13:00:00Z', now)).toEqual({
      at: now,
      skewed: true,
    });
  });

  it('uses the server time when the client sends none', () => {
    expect(clampCapturedAt(undefined, now)).toEqual({ at: now, skewed: false });
  });
});

describe('teacherMayWriteSession', () => {
  const session = {
    date: new Date('2026-10-15T00:00:00Z'),
    endsAt: new Date('2026-10-15T19:00:00Z'), // 22:00 local
  };

  it('allows the session day in the organization timezone', () => {
    expect(
      teacherMayWriteSession(new Date('2026-10-15T08:00:00Z'), session, TZ),
    ).toBe(true);
    // 23:30 local is still the 15th
    expect(
      teacherMayWriteSession(new Date('2026-10-15T20:30:00Z'), session, TZ),
    ).toBe(true);
  });

  it('refuses the next day and the day before', () => {
    expect(
      teacherMayWriteSession(new Date('2026-10-16T06:00:00Z'), session, TZ),
    ).toBe(false);
    expect(
      teacherMayWriteSession(new Date('2026-10-14T18:00:00Z'), session, TZ),
    ).toBe(false);
  });

  it('keeps a class that crosses midnight writable until it ends', () => {
    const late = {
      date: session.date,
      endsAt: new Date('2026-10-15T22:30:00Z'),
    }; // 01:30 local
    expect(
      teacherMayWriteSession(new Date('2026-10-15T21:15:00Z'), late, TZ),
    ).toBe(true);
    expect(
      teacherMayWriteSession(new Date('2026-10-15T23:00:00Z'), late, TZ),
    ).toBe(false);
  });
});

describe('incomingAttendanceWins', () => {
  const t = new Date('2026-10-15T10:00:00Z');
  it('later or equal markedAt wins', () => {
    expect(incomingAttendanceWins(t, new Date('2026-10-15T10:00:01Z'))).toBe(
      true,
    );
    expect(incomingAttendanceWins(t, t)).toBe(true);
    expect(incomingAttendanceWins(t, new Date('2026-10-15T09:59:59Z'))).toBe(
      false,
    );
  });
});

describe('summarize', () => {
  const quran = (
    type: LedgerRow['type'],
    [s1, a1, s2, a2]: number[],
    [p1, p2]: number[],
    at: string,
  ): LedgerRow => ({
    type,
    surahStart: s1,
    ayahStart: a1,
    surahEnd: s2,
    ayahEnd: a2,
    pageFrom: p1,
    pageTo: p2,
    loggedAt: new Date(at),
  });

  it('is empty for no logs', () => {
    expect(summarize([])).toEqual({
      pagesMemorized: 0,
      ayahsMemorized: 0,
      lastPageReached: null,
      lastSurah: null,
      lastAyah: null,
      lastLoggedAt: null,
    });
  });

  it('unions overlapping ranges and ignores revisions for coverage', () => {
    const s = summarize([
      quran('NEW', [78, 1, 78, 20], [582, 582], '2026-10-01T10:00:00Z'),
      quran('NEW', [78, 15, 78, 40], [582, 583], '2026-10-02T10:00:00Z'),
      quran('REVISION', [1, 1, 1, 7], [1, 1], '2026-10-03T10:00:00Z'),
    ]);
    expect(s.ayahsMemorized).toBe(40);
    expect(s.pagesMemorized).toBe(2);
    expect(s.lastPageReached).toBe(583);
    expect([s.lastSurah, s.lastAyah]).toEqual([78, 40]);
    // The revision still counts as activity
    expect(s.lastLoggedAt).toEqual(new Date('2026-10-03T10:00:00Z'));
  });

  it('leaves coverage and position unchanged for a test, like a revision', () => {
    const base = [quran('NEW', [78, 1, 78, 20], [582, 582], '2026-10-01T10:00:00Z')];
    const withTest = summarize([
      ...base,
      quran('TEST', [1, 1, 1, 7], [1, 1], '2026-10-02T10:00:00Z'),
    ]);
    const before = summarize(base);
    expect(withTest).toEqual({ ...before, lastLoggedAt: new Date('2026-10-02T10:00:00Z') });
  });

  it('takes the last position by class time, not by insertion order', () => {
    const s = summarize([
      quran('NEW', [80, 1, 80, 10], [585, 585], '2026-10-05T10:00:00Z'),
      quran('INITIAL', [114, 1, 114, 6], [604, 604], '2026-09-01T10:00:00Z'),
    ]);
    expect(s.lastPageReached).toBe(585);
    expect(s.pagesMemorized).toBe(2);
    expect(s.ayahsMemorized).toBe(16);
  });

  it('counts pages for texts with no ayah ranges', () => {
    const text: LedgerRow = {
      type: 'NEW',
      surahStart: null,
      ayahStart: null,
      surahEnd: null,
      ayahEnd: null,
      pageFrom: 3,
      pageTo: 5,
      loggedAt: new Date('2026-10-01T10:00:00Z'),
    };
    const s = summarize([text, { ...text, pageFrom: 5, pageTo: 6 }]);
    expect(s.pagesMemorized).toBe(4);
    expect(s.ayahsMemorized).toBe(0);
    expect(s.lastSurah).toBeNull();
  });
});
