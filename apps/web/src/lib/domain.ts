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

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Saturday → Friday (Arabic week). 0=Sun … 6=Sat in UTC. */
export function weekBoundsSaturdayFirst(from: string) {
  const day = new Date(`${from}T12:00:00Z`).getUTCDay();
  const offset = (day + 1) % 7;
  const start = addDays(from, -offset);
  return { from: start, to: addDays(start, 6) };
}

/** Column order for lobby: Sat, Sun, … Fri. */
export const LOBBY_WEEKDAY_ORDER = [6, 0, 1, 2, 3, 4, 5] as const;

export function lobbyWeekDates(weekStart: string) {
  return LOBBY_WEEKDAY_ORDER.map((weekday, i) => ({
    weekday,
    date: addDays(weekStart, i),
  }));
}

export function formatTime(iso: string, locale: string, timeZone?: string) {
  return new Date(iso).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  });
}

/** Each end is bidi-isolated: Arabic "ص/م" inside a forced-LTR span scrambled the order. */
export function formatTimeRange(start: string, end: string, locale: string, timeZone?: string) {
  return `\u2068${formatTime(start, locale, timeZone)}\u2069 – \u2068${formatTime(end, locale, timeZone)}\u2069`;
}

function numericFromParts(parts: Intl.DateTimeFormatPart[]) {
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  const y = pick('year');
  const m = pick('month').padStart(2, '0');
  const d = pick('day').padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** ISO calendar date (yyyy-mm-dd) in UTC — passthrough when already ISO. */
export function formatGregorianNumeric(date: string) {
  return date;
}

/** Umm al-Qura civil Hijri as yyyy-mm-dd (UTC noon on the Gregorian day). */
export function formatHijriNumeric(date: string) {
  const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone: 'UTC',
  }).formatToParts(new Date(`${date}T12:00:00Z`));
  return numericFromParts(parts);
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

/** NFR-02: numeric Gregorian and Hijri wherever a date is shown. */
export function formatDate(date: string, _locale: string) {
  return `${formatGregorianNumeric(date)} · ${formatHijriNumeric(date)}`;
}

/** An instant in the viewer's clock, with the Hijri date of that local day. */
export function formatDateTime(iso: string, locale: string) {
  const instant = new Date(iso);
  const gregParts = new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const greg = numericFromParts(gregParts);
  const hijriParts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(instant);
  const hijri = numericFromParts(hijriParts);
  const time = instant.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${greg} · ${hijri} · ${time}`;
}

/** Search key for Arabic names: no tashkeel or tatweel, one alef, ة=ه, ى=ي. */
export const normalizeArabic = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
