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
export function formatTimeRange(
  start: string,
  end: string,
  locale: string,
  timeZone?: string,
) {
  return `\u2068${formatTime(start, locale, timeZone)}\u2069 – \u2068${formatTime(end, locale, timeZone)}\u2069`;
}

export function formatNumericYmd(
  y: string | number,
  m: string | number,
  d: string | number,
) {
  return `${String(y)}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function numericFromParts(parts: Intl.DateTimeFormatPart[]) {
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return formatNumericYmd(pick('year'), pick('month'), pick('day'));
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

export type DateCalendar = 'gregorian' | 'hijri';

/** One calendar date (yyyy-mm-dd), Gregorian by default. */
export function formatDate(
  date: string,
  _locale: string,
  calendar: DateCalendar = 'gregorian',
) {
  return calendar === 'hijri'
    ? formatHijriNumeric(date)
    : formatGregorianNumeric(date);
}

/** Weekday 0=Sun … 6=Sat for an ISO mosque calendar date (UTC noon). */
export function weekdayUtc(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/** mm-dd slice of numeric yyyy-mm-dd (Gregorian or Hijri). */
export function formatMonthDay(
  date: string,
  locale: string,
  calendar: DateCalendar = 'gregorian',
) {
  const full = formatDate(date, locale, calendar);
  return full.length >= 10 ? full.slice(5) : full;
}

export function formatWeekDayLabel(
  date: string,
  locale: string,
  calendar: DateCalendar,
  weekdayName: string,
  opts?: { monthDayOnly?: boolean },
) {
  const dateStr = opts?.monthDayOnly
    ? formatMonthDay(date, locale, calendar)
    : formatDate(date, locale, calendar);
  return `${weekdayName} ${dateStr}`;
}

/** Gregorian yyyy-mm-dd for an instant (UTC calendar day, matches session `date` fields). */
function gregorianUtcFromInstant(iso: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC',
  }).formatToParts(new Date(iso));
  return numericFromParts(parts);
}

/** Hijri yyyy-mm-dd for an instant (UTC). */
function hijriUtcFromInstant(iso: string) {
  const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone: 'UTC',
  }).formatToParts(new Date(iso));
  return numericFromParts(parts);
}

/** UTC calendar date + local time; one calendar only, always yyyy-mm-dd. */
export function formatDateTime(
  iso: string,
  locale: string,
  calendar: DateCalendar = 'gregorian',
) {
  const instant = new Date(iso);
  const datePart =
    calendar === 'hijri'
      ? hijriUtcFromInstant(iso)
      : gregorianUtcFromInstant(iso);
  const time = instant.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${datePart} · ${time}`;
}

/** Saturday-first week bounds and column dates (Sat … Fri). */
export function saturdayWeekBounds(anchor = today()) {
  const { from, to } = weekBoundsSaturdayFirst(anchor);
  return { from, to, days: lobbyWeekDates(from).map((d) => d.date) };
}

/** Search key for Arabic names: no tashkeel or tatweel, one alef, ة=ه, ى=ي. */
export const normalizeArabic = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
