import {
  addDays,
  dateIn,
  wallTimeIn,
  weekdayOf,
  zonedToUtc,
} from './zoned-time';

describe('zoned time', () => {
  it('converts Damascus wall time (UTC+3, no DST) to UTC', () => {
    expect(
      zonedToUtc('2026-10-08', '18:00', 'Asia/Damascus').toISOString(),
    ).toBe('2026-10-08T15:00:00.000Z');
  });

  it('follows DST on both sides of the switch', () => {
    // Berlin: UTC+1 in winter, UTC+2 from 29 March 2026.
    expect(
      zonedToUtc('2026-03-28', '18:00', 'Europe/Berlin').toISOString(),
    ).toBe('2026-03-28T17:00:00.000Z');
    expect(
      zonedToUtc('2026-03-30', '18:00', 'Europe/Berlin').toISOString(),
    ).toBe('2026-03-30T16:00:00.000Z');
  });

  it('round-trips wall time and date', () => {
    const instant = zonedToUtc('2026-12-31', '23:30', 'Asia/Damascus');
    expect(wallTimeIn(instant, 'Asia/Damascus')).toBe('23:30');
    expect(dateIn(instant, 'Asia/Damascus')).toBe('2026-12-31');
    expect(dateIn(instant, 'UTC')).toBe('2026-12-31');
  });

  it('adds days across month and year ends', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('numbers weekdays from Sunday', () => {
    expect(weekdayOf('2026-10-11')).toBe(0);
    expect(weekdayOf('2026-10-08')).toBe(4);
  });
});
