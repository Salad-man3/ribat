import assert from 'node:assert/strict';
import test from 'node:test';
import { MemberProgressResponseSchema } from './families.js';

test('MemberProgressResponseSchema accepts teaching and course metrics', () => {
  const parsed = MemberProgressResponseSchema.safeParse({
    memberId: '00000000-0000-4000-8000-000000000001',
    memberName: 'Test',
    courses: [
      {
        courseId: '00000000-0000-4000-8000-000000000002',
        courseName: 'Hifz',
        type: 'MEMORIZATION',
        enrollmentStatus: 'ACTIVE',
        attendance: {
          PRESENT: 1,
          ABSENT: 0,
          LATE: 0,
          EXCUSED: 0,
          total: 1,
          rate: 1,
        },
        pagesMemorized: 12,
        explanationPercent: null,
      },
    ],
    teaching: [],
    recentAttendance: [],
    attendanceHistory: [],
    summaries: [],
    tests: [],
    homework: [],
    excuses: [],
    hifz: null,
  });
  assert.equal(parsed.success, true);
});
