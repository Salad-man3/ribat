import { describe, expect, it } from 'vitest';
import { formatDate, formatHijri } from './domain';

describe('dates (NFR-02)', () => {
  it('shows the Umm al-Qura Hijri date next to the Gregorian one', () => {
    // 15 October 2026 is 4 Jumada al-Ula 1448 AH
    expect(formatHijri('2026-10-15', 'en')).toMatch(/1448/);
    expect(formatDate('2026-10-15', 'en')).toMatch(/Oct.*·.*1448/);
  });
});
