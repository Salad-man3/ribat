import { attendanceRateFromCounters } from '@ribat/shared';
import {
  addAttendanceStatus,
  mergeCourseMetrics,
  pagesInRange,
} from './stats-metrics';

describe('stats-metrics', () => {
  it('adds attendance statuses', () => {
    let c = { attendancePresent: 0, attendanceLate: 0, attendanceAbsent: 0 };
    c = addAttendanceStatus(c, 'PRESENT');
    c = addAttendanceStatus(c, 'LATE');
    expect(attendanceRateFromCounters(c)).toBe(1);
  });

  it('counts pages in range', () => {
    expect(pagesInRange(1, 3)).toBe(3);
  });

  it('merges course metrics', () => {
    const a = {
      attendancePresent: 1,
      attendanceLate: 0,
      attendanceAbsent: 0,
      pagesMemorized: 2,
      testsPassed: 1,
      testsTaken: 1,
      sessionsHeld: 1,
      sessionsMissingAttendance: 0,
    };
    const b = { ...a, attendancePresent: 2, sessionsHeld: 2 };
    const m = mergeCourseMetrics(a, b);
    expect(m.attendancePresent).toBe(3);
    expect(m.sessionsHeld).toBe(3);
  });
});
