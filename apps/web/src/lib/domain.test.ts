import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatHijri,
  formatMonthDay,
  formatNumericYmd,
  formatTimeRange,
  normalizeArabic,
} from './domain';

describe('dates', () => {
  it('formatNumericYmd zero-pads and orders y-m-d', () => {
    expect(formatNumericYmd(2026, 3, 5)).toBe('2026-03-05');
  });

  it('formatDate defaults to Gregorian yyyy-mm-dd only', () => {
    expect(formatDate('2026-10-15', 'en')).toBe('2026-10-15');
    expect(formatDate('2026-10-15', 'en')).not.toContain(' · ');
  });

  it('formatDate can show Hijri numeric only', () => {
    expect(formatHijri('2026-10-15', 'en')).toMatch(/1448/);
    expect(formatDate('2026-10-15', 'en', 'hijri')).toBe('1448-05-04');
  });

  it('formatMonthDay drops the year', () => {
    expect(formatMonthDay('2026-10-15', 'en')).toBe('10-15');
    expect(formatMonthDay('2026-10-15', 'en', 'hijri')).toBe('05-04');
  });

  it('formatDateTime uses yyyy-mm-dd date plus time', () => {
    const greg = formatDateTime('2026-10-15T12:00:00Z', 'en');
    expect(greg).toMatch(/^2026-10-15 · /);
    expect(greg.split(' · ').length).toBe(2);
    const hijri = formatDateTime('2026-10-15T12:00:00Z', 'en', 'hijri');
    expect(hijri).toMatch(/^1448-\d{2}-\d{2} · /);
  });

  it('formatDateTime gregorian date uses UTC day not local drift', () => {
    // 2026-10-15 23:30 UTC is still the 15th in UTC; local TZ must not flip to 16th or dd-mm order
    const line = formatDateTime('2026-10-15T23:30:00Z', 'en');
    expect(line.startsWith('2026-10-15 ·')).toBe(true);
  });

  it('isolates each end of a time range so Arabic AM/PM keeps its order', () => {
    const range = formatTimeRange(
      '2026-10-15T12:00:00Z',
      '2026-10-15T14:00:00Z',
      'ar',
      'Asia/Damascus',
    );
    expect(range).toMatch(/^\u2068[^\u2069]+\u2069 – \u2068[^\u2069]+\u2069$/);
    expect(range).toContain('03:00');
  });
});

describe('normalizeArabic', () => {
  it('ignores tashkeel, hamza forms, ta marbuta and alef maqsura', () => {
    expect(normalizeArabic('أَحْمَد')).toBe(normalizeArabic('احمد'));
    expect(normalizeArabic('فاطمة')).toBe(normalizeArabic('فاطمه'));
    expect(normalizeArabic('مُصطفى')).toContain(normalizeArabic('مصطفي'));
  });
});
