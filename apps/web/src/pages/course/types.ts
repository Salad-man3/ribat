import type { CourseResponse } from '@ribat/shared';

export type SectionProps = {
  course: CourseResponse;
  staff: boolean;
  writable: boolean;
  /** May open class mode for a session on this course (staff or assigned teacher). */
  canOpenClass?: boolean;
};
