import type { CourseResponse } from '@ribat/shared';

export type SectionProps = {
  course: CourseResponse;
  staff: boolean;
  writable: boolean;
};
