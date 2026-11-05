import { addDays } from './domain';

export const TEACHER_PAST_SESSION_EDIT_DAYS = 7;

export function isHistorySession(sessionDate: string, today: string): boolean {
  return sessionDate < today;
}

/** Mirror server policy for UI: staff always; teachers within edit window. */
export function canEditHistorySession(
  sessionDate: string,
  today: string,
  isStaff: boolean,
): boolean {
  if (!isHistorySession(sessionDate, today)) return true;
  if (isStaff) return true;
  const oldest = addDays(today, -TEACHER_PAST_SESSION_EDIT_DAYS);
  return sessionDate >= oldest;
}
