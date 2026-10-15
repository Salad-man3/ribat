import { describe, expect, it } from 'vitest';
import { formatDate, formatHijri, formatTimeRange, normalizeArabic } from './domain';

describe('dates (NFR-02)', () => {
  it('shows the Umm al-Qura Hijri date next to the Gregorian one', () => {
    // 15 October 2026 is 4 Jumada al-Ula 1448 AH
    expect(formatHijri('2026-10-15', 'en')).toMatch(/1448/);
    expect(formatDate('2026-10-15', 'en')).toMatch(/Oct.*·.*1448/);
  });

  it('isolates each end of a time range so Arabic AM/PM keeps its order', () => {
    const range = formatTimeRange('2026-10-15T12:00:00Z', '2026-10-15T14:00:00Z', 'ar', 'Asia/Damascus');
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
