import { COURSE_TRANSITIONS, type CourseStatus } from '@ribat/shared';

export function canTransition(from: CourseStatus, to: CourseStatus): boolean {
  return COURSE_TRANSITIONS[from].includes(to);
}

/** OQ-1: finished and archived courses are history, read-only. */
export function isWritable(status: CourseStatus): boolean {
  return status !== 'FINISHED' && status !== 'ARCHIVED';
}
