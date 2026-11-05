import { describe, expect, it } from 'vitest';
import {
  attendanceRateFromMarks,
  buildAttendanceGrid,
  worstAttendanceStatus,
} from './attendance-grid';
import { weekBoundsSaturdayFirst } from './domain';

describe('worstAttendanceStatus', () => {
  it('prefers absent over present on the same day', () => {
    expect(worstAttendanceStatus('PRESENT', 'ABSENT')).toBe('ABSENT');
    expect(worstAttendanceStatus('LATE', 'ABSENT')).toBe('ABSENT');
  });
});

describe('attendanceRateFromMarks', () => {
  it('ignores excused marks in the rate', () => {
    expect(attendanceRateFromMarks(['EXCUSED', 'ABSENT'])).toBe(0);
    expect(attendanceRateFromMarks(['EXCUSED'])).toBeNull();
  });
});

describe('buildAttendanceGrid', () => {
  it('starts weeks on Saturday', () => {
    const grid = buildAttendanceGrid([], '2026-10-29', 30);
    expect(grid.weeks.length).toBeGreaterThan(0);
    const first = grid.weeks[0]![0]!.date;
    expect(weekBoundsSaturdayFirst(first).from).toBe(first);
  });

  it('merges multiple halaqas on one day to the worst status', () => {
    const grid = buildAttendanceGrid(
      [
        { date: '2026-10-28', courseName: 'A', status: 'PRESENT' },
        { date: '2026-10-28', courseName: 'B', status: 'ABSENT' },
      ],
      '2026-10-28',
      30,
    );
    const cell = grid.weeks.flat().find((c) => c.date === '2026-10-28');
    expect(cell?.status).toBe('ABSENT');
  });

  it('leaves unmarked in-window days null', () => {
    const grid = buildAttendanceGrid([], '2026-10-28', 30);
    const cell = grid.weeks.flat().find((c) => c.date === '2026-10-28');
    expect(cell?.inWindow).toBe(true);
    expect(cell?.status).toBeNull();
  });
});
