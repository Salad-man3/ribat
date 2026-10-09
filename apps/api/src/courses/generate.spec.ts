import { wallTimeIn } from '../common/zoned-time';
import {
  computePrayerTimes,
  type PrayerSettings,
} from '../prayer-times/compute';
import { generateSessions, type RuleInput } from './generate';

const damascus: PrayerSettings = {
  latitude: 33.5131,
  longitude: 36.3096,
  timezone: 'Asia/Damascus',
  prayerMethod: 'MuslimWorldLeague',
  prayerOffsets: {},
};

// Sunday and Tuesday, from Asr to 18:00 (WF-04 example).
const asrToSix = (
  weekday: number,
  extra: Partial<RuleInput> = {},
): RuleInput => ({
  id: `rule-${weekday}`,
  weekday,
  startAnchor: 'PRAYER',
  startTime: null,
  startPrayer: 'ASR',
  startOffsetMin: 0,
  endAnchor: 'FIXED',
  endTime: '18:00',
  endPrayer: null,
  endOffsetMin: 0,
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  ...extra,
});

const base = {
  settings: damascus,
  course: { startDate: null, endDate: null },
  rules: [asrToSix(0), asrToSix(2)],
  pauses: [],
  from: '2026-10-11', // a Sunday
  to: '2026-10-24',
};

describe('generateSessions', () => {
  it('creates one session per matching weekday, Asr to 18:00 local', () => {
    const sessions = generateSessions(base);
    expect(sessions.map((s) => s.date)).toEqual([
      '2026-10-11',
      '2026-10-13',
      '2026-10-18',
      '2026-10-20',
    ]);
    const first = sessions[0];
    expect(wallTimeIn(first.startsAt, 'Asia/Damascus')).toBe(
      computePrayerTimes(damascus, '2026-10-11').asr,
    );
    expect(wallTimeIn(first.endsAt, 'Asia/Damascus')).toBe('18:00');
    expect(first.scheduleId).toBe('rule-0');
  });

  it('applies the org prayer offsets and the rule offset', () => {
    const [plain] = generateSessions(base);
    const [shifted] = generateSessions({
      ...base,
      settings: { ...damascus, prayerOffsets: { asr: 5 } },
      rules: [asrToSix(0, { startOffsetMin: 10 })],
    });
    expect(shifted.startsAt.getTime() - plain.startsAt.getTime()).toBe(
      15 * 60_000,
    );
  });

  it('skips paused days (decision 4.9)', () => {
    const sessions = generateSessions({
      ...base,
      pauses: [{ fromDate: '2026-10-12', toDate: '2026-10-18' }],
    });
    expect(sessions.map((s) => s.date)).toEqual(['2026-10-11', '2026-10-20']);
  });

  it('honours course dates and rule effective ranges', () => {
    const sessions = generateSessions({
      ...base,
      course: { startDate: '2026-10-12', endDate: '2026-10-19' },
      rules: [asrToSix(0), asrToSix(2, { effectiveTo: '2026-10-13' })],
    });
    expect(sessions.map((s) => s.date)).toEqual(['2026-10-13', '2026-10-18']);
  });

  it('drops a day whose end is not after its start', () => {
    const sessions = generateSessions({
      ...base,
      rules: [asrToSix(0, { endTime: '12:00' })],
    });
    expect(sessions).toEqual([]);
  });

  it('is deterministic, so a second run yields the same keys (idempotent inserts)', () => {
    const key = (s: { date: string; startsAt: Date }) =>
      `${s.date}|${s.startsAt.toISOString()}`;
    expect(generateSessions(base).map(key)).toEqual(
      generateSessions(base).map(key),
    );
  });

  it('keeps fixed times on the wall clock across DST', () => {
    const berlin = {
      ...damascus,
      timezone: 'Europe/Berlin',
      latitude: 52.52,
      longitude: 13.4,
    };
    const fixed = asrToSix(6, {
      startAnchor: 'FIXED',
      startTime: '17:00',
      startPrayer: null,
    });
    const sessions = generateSessions({
      ...base,
      settings: berlin,
      rules: [fixed],
      from: '2026-03-21',
      to: '2026-04-04',
    });
    expect(
      sessions.map((s) => wallTimeIn(s.startsAt, 'Europe/Berlin')),
    ).toEqual(['17:00', '17:00', '17:00']);
    // Saturdays 21 and 28 March are UTC+1; DST starts 29 March, so 4 April is UTC+2.
    expect(sessions.map((s) => s.startsAt.getUTCHours())).toEqual([16, 16, 15]);
  });
});
