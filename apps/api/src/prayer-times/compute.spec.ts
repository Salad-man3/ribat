import { computePrayerTimes, type PrayerSettings } from './compute';

// Aladhan /v1/timings/08-10-2026?latitude=33.5131&longitude=36.3096&method=3, fetched 2026-10-08.
const ALADHAN_DAMASCUS = {
  fajr: '05:11',
  sunrise: '06:34',
  dhuhr: '12:22',
  asr: '15:41',
  maghrib: '18:10',
  isha: '19:28',
};

const damascus: PrayerSettings = {
  latitude: 33.5130695,
  longitude: 36.3095814,
  timezone: 'Asia/Damascus',
  prayerMethod: 'MuslimWorldLeague',
  prayerOffsets: {},
};

const minutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

describe('computePrayerTimes', () => {
  it('matches the Aladhan reference for Damascus within 2 minutes', () => {
    const computed = computePrayerTimes(damascus, '2026-10-08');
    for (const [key, reference] of Object.entries(ALADHAN_DAMASCUS)) {
      const diff = Math.abs(
        minutes(computed[key as keyof typeof computed]) - minutes(reference),
      );
      expect(diff).toBeLessThanOrEqual(2);
    }
  });

  it('applies per-prayer offsets', () => {
    const base = computePrayerTimes(damascus, '2026-10-08');
    const shifted = computePrayerTimes(
      { ...damascus, prayerOffsets: { maghrib: 3, fajr: -5 } },
      '2026-10-08',
    );
    expect(minutes(shifted.maghrib) - minutes(base.maghrib)).toBe(3);
    expect(minutes(shifted.fajr) - minutes(base.fajr)).toBe(-5);
    expect(shifted.isha).toBe(base.isha);
  });
});
