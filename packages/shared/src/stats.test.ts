import assert from 'node:assert/strict';
import test from 'node:test';
import { attendanceRateFromCounters } from './stats.js';

test('attendanceRateFromCounters matches portal semantics', () => {
  assert.equal(
    attendanceRateFromCounters({
      attendancePresent: 8,
      attendanceLate: 1,
      attendanceAbsent: 1,
    }),
    0.9,
  );
});

test('attendanceRateFromCounters returns null without countable marks', () => {
  assert.equal(
    attendanceRateFromCounters({
      attendancePresent: 0,
      attendanceLate: 0,
      attendanceAbsent: 0,
    }),
    null,
  );
});
