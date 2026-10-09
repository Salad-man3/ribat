import {
  CalculationMethod,
  Coordinates,
  PrayerTimes as AdhanPrayerTimes,
} from 'adhan';
import type { PrayerMethod, PrayerOffsets, PrayerTimes } from '@ribat/shared';
import { wallTimeIn } from '../common/zoned-time';

export const PRAYER_KEYS = [
  'fajr',
  'sunrise',
  'dhuhr',
  'asr',
  'maghrib',
  'isha',
] as const;
export type PrayerKey = (typeof PRAYER_KEYS)[number];

export type PrayerSettings = {
  latitude: number;
  longitude: number;
  timezone: string;
  prayerMethod: PrayerMethod;
  prayerOffsets: PrayerOffsets;
};

/**
 * The single source of prayer times for previews and session generation.
 * `date` is the mosque's calendar date. adhan reads the Date's local Y/M/D,
 * so it is built with the local constructor and the server timezone does not matter.
 */
export function computePrayerInstants(
  settings: PrayerSettings,
  date: string,
): Record<PrayerKey, Date> {
  const [y, m, d] = date.split('-').map(Number);
  const params = CalculationMethod[settings.prayerMethod]();
  for (const key of PRAYER_KEYS)
    params.adjustments[key] = settings.prayerOffsets[key] ?? 0;
  const times = new AdhanPrayerTimes(
    new Coordinates(settings.latitude, settings.longitude),
    new Date(y, m - 1, d),
    params,
  );
  return {
    fajr: times.fajr,
    sunrise: times.sunrise,
    dhuhr: times.dhuhr,
    asr: times.asr,
    maghrib: times.maghrib,
    isha: times.isha,
  };
}

export function computePrayerTimes(
  settings: PrayerSettings,
  date: string,
): PrayerTimes {
  const instants = computePrayerInstants(settings, date);
  return Object.fromEntries(
    PRAYER_KEYS.map((key) => [
      key,
      wallTimeIn(instants[key], settings.timezone),
    ]),
  ) as PrayerTimes;
}

/** Aladhan's numeric ids for the methods Ribat supports. */
export const ALADHAN_METHOD_ID: Record<PrayerMethod, number> = {
  Karachi: 1,
  NorthAmerica: 2,
  MuslimWorldLeague: 3,
  UmmAlQura: 4,
  Egyptian: 5,
  Tehran: 7,
  Kuwait: 9,
  Qatar: 10,
  Singapore: 11,
  Turkey: 13,
  MoonsightingCommittee: 15,
  Dubai: 16,
};
