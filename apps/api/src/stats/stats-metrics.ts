import type { AttendanceStatus } from '@prisma/client';
import type {
  StatsAttendanceCounters,
  StatsCourseMetrics,
  StatsMemberMetrics,
  StatsOrgMetrics,
  StatsProgressCounters,
  StatsTeacherMetrics,
} from '@ribat/shared';

export function emptyAttendanceCounters(): StatsAttendanceCounters {
  return { attendancePresent: 0, attendanceLate: 0, attendanceAbsent: 0 };
}

export function emptyProgressCounters(): StatsProgressCounters {
  return { pagesMemorized: 0, testsPassed: 0, testsTaken: 0 };
}

export function addAttendanceStatus(
  counters: StatsAttendanceCounters,
  status: AttendanceStatus,
): StatsAttendanceCounters {
  if (status === 'PRESENT') return { ...counters, attendancePresent: counters.attendancePresent + 1 };
  if (status === 'LATE') return { ...counters, attendanceLate: counters.attendanceLate + 1 };
  if (status === 'ABSENT') return { ...counters, attendanceAbsent: counters.attendanceAbsent + 1 };
  return counters;
}

export function mergeAttendance(
  a: StatsAttendanceCounters,
  b: StatsAttendanceCounters,
): StatsAttendanceCounters {
  return {
    attendancePresent: a.attendancePresent + b.attendancePresent,
    attendanceLate: a.attendanceLate + b.attendanceLate,
    attendanceAbsent: a.attendanceAbsent + b.attendanceAbsent,
  };
}

export function mergeProgress(
  a: StatsProgressCounters,
  b: StatsProgressCounters,
): StatsProgressCounters {
  return {
    pagesMemorized: a.pagesMemorized + b.pagesMemorized,
    testsPassed: a.testsPassed + b.testsPassed,
    testsTaken: a.testsTaken + b.testsTaken,
  };
}

export function pagesInRange(pageFrom: number, pageTo: number): number {
  return Math.max(0, pageTo - pageFrom + 1);
}

export function mergeCourseMetrics(a: StatsCourseMetrics, b: StatsCourseMetrics): StatsCourseMetrics {
  return {
    ...mergeAttendance(a, b),
    ...mergeProgress(a, b),
    sessionsHeld: a.sessionsHeld + b.sessionsHeld,
    sessionsMissingAttendance: a.sessionsMissingAttendance + b.sessionsMissingAttendance,
  };
}

export function mergeTeacherMetrics(
  a: StatsTeacherMetrics,
  b: StatsTeacherMetrics,
): StatsTeacherMetrics {
  return {
    ...mergeAttendance(a, b),
    ...mergeProgress(a, b),
    logged: a.logged || b.logged,
  };
}

export function mergeMemberMetrics(a: StatsMemberMetrics, b: StatsMemberMetrics): StatsMemberMetrics {
  return { ...mergeAttendance(a, b), ...mergeProgress(a, b) };
}

export function mergeOrgMetrics(a: StatsOrgMetrics, b: StatsOrgMetrics): StatsOrgMetrics {
  return {
    activeMembers: Math.max(a.activeMembers, b.activeMembers),
    activeCourses: Math.max(a.activeCourses, b.activeCourses),
    activeTeachers: Math.max(a.activeTeachers, b.activeTeachers),
    pendingJoinApplications: Math.max(a.pendingJoinApplications, b.pendingJoinApplications),
    ...mergeAttendance(a, b),
    ...mergeProgress(a, b),
  };
}
