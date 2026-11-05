import type { AttendanceMarkDay, AttendanceStatus } from '@ribat/shared';
import { addDays, weekBoundsSaturdayFirst } from './domain';

const WORST_RANK: Record<AttendanceStatus, number> = {
  ABSENT: 0,
  LATE: 1,
  EXCUSED: 2,
  PRESENT: 3,
};

export function worstAttendanceStatus(
  a: AttendanceStatus,
  b: AttendanceStatus,
): AttendanceStatus {
  return WORST_RANK[a] <= WORST_RANK[b] ? a : b;
}

export function attendanceRateFromMarks(
  statuses: AttendanceStatus[],
): number | null {
  let present = 0;
  let late = 0;
  let absent = 0;
  for (const s of statuses) {
    if (s === 'PRESENT') present += 1;
    else if (s === 'LATE') late += 1;
    else if (s === 'ABSENT') absent += 1;
  }
  const total = present + late + absent;
  if (total === 0) return null;
  return (present + late) / total;
}

export type AttendanceGridCell = {
  date: string;
  /** null = no mark or outside the selected window (padding cells still show date) */
  status: AttendanceStatus | null;
  inWindow: boolean;
};

export type AttendanceGridWeek = AttendanceGridCell[];

export type AttendanceGrid = {
  weeks: AttendanceGridWeek[];
  windowFrom: string;
  windowTo: string;
  rate: number | null;
};

export function buildAttendanceGrid(
  history: AttendanceMarkDay[],
  today: string,
  days: 30 | 90,
): AttendanceGrid {
  const windowFrom = addDays(today, -(days - 1));
  const windowTo = today;

  const byDate = new Map<string, AttendanceStatus>();
  const windowStatuses: AttendanceStatus[] = [];
  for (const row of history) {
    if (row.date < windowFrom || row.date > windowTo) continue;
    windowStatuses.push(row.status);
    const prev = byDate.get(row.date);
    byDate.set(
      row.date,
      prev ? worstAttendanceStatus(prev, row.status) : row.status,
    );
  }

  const gridStart = weekBoundsSaturdayFirst(windowFrom).from;
  const gridEnd = weekBoundsSaturdayFirst(windowTo).to;

  const weeks: AttendanceGridWeek[] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    const week: AttendanceGridWeek = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(cursor, i);
      const inWindow = date >= windowFrom && date <= windowTo;
      week.push({
        date,
        status: inWindow ? (byDate.get(date) ?? null) : null,
        inWindow,
      });
    }
    weeks.push(week);
    cursor = addDays(cursor, 7);
  }

  return {
    weeks,
    windowFrom,
    windowTo,
    rate: attendanceRateFromMarks(windowStatuses),
  };
}
