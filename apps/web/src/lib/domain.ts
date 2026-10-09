import type { CourseStatus, PrayerMethod, PrayerTimes } from '@ribat/shared';

// @ribat/shared builds to CommonJS, so the web build imports its types only.
// These mirror values defined there; keep them in step.

export const PRAYER_METHODS: PrayerMethod[] = [
  'MuslimWorldLeague',
  'Egyptian',
  'Karachi',
  'UmmAlQura',
  'Dubai',
  'MoonsightingCommittee',
  'NorthAmerica',
  'Kuwait',
  'Qatar',
  'Singapore',
  'Tehran',
  'Turkey',
];

export const PRAYERS = [
  'fajr',
  'sunrise',
  'dhuhr',
  'asr',
  'maghrib',
  'isha',
] as const satisfies readonly (keyof PrayerTimes)[];

/** Mirrors COURSE_TRANSITIONS (OQ-1). */
export const COURSE_TRANSITIONS: Record<CourseStatus, CourseStatus[]> = {
  DRAFT: ['ACTIVE'],
  ACTIVE: ['PAUSED', 'FINISHED'],
  PAUSED: ['ACTIVE', 'FINISHED'],
  FINISHED: ['ARCHIVED'],
  ARCHIVED: [],
};

export const isWritable = (status: CourseStatus) =>
  status !== 'FINISHED' && status !== 'ARCHIVED';

/** 0 = Sunday, like CourseSchedule.weekday. */
export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

export const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

export const fromMinutes = (total: number) => {
  const wrapped = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
};

export const today = () => new Date().toISOString().slice(0, 10);

export function formatTime(iso: string, locale: string, timeZone?: string) {
  return new Date(iso).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  });
}

export function formatDate(date: string, locale: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}
