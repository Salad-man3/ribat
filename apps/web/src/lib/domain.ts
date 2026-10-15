import type { CourseStatus, PrayerMethod, PrayerTimes } from '@ribat/shared';

// These mirror values defined in @ribat/shared; keep them in step. Runtime imports from it
// work since vite.config.ts pre-bundles it (class mode uses its Zod schemas), so a new
// constant can be imported instead of mirrored.

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

/** Umm al-Qura, the civil Hijri calendar. Built into every modern browser's Intl. */
export function formatHijri(date: string, locale: string) {
  return new Intl.DateTimeFormat(`${locale}-u-ca-islamic-umalqura`, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

/** NFR-02: Gregorian and Hijri wherever a date is shown. */
export function formatDate(date: string, locale: string) {
  const gregorian = new Date(`${date}T12:00:00Z`).toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  return `${gregorian} · ${formatHijri(date, locale)}`;
}

/** An instant in the viewer's clock, with the Hijri date of that local day. */
export function formatDateTime(iso: string, locale: string) {
  const instant = new Date(iso);
  const hijri = new Intl.DateTimeFormat(`${locale}-u-ca-islamic-umalqura`, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(instant);
  return `${instant.toLocaleString(locale)} · ${hijri}`;
}
