import { toDateString } from '../common/zoned-time';

type RowDates = {
  startDate: Date | null;
  endDate: Date | null;
};

export function courseSessionWindow(
  course: RowDates & { programId: string | null },
  program: RowDates | null,
): { startDate: string | null; endDate: string | null } {
  if (course.programId && program) {
    return {
      startDate: program.startDate ? toDateString(program.startDate) : null,
      endDate: program.endDate ? toDateString(program.endDate) : null,
    };
  }
  return {
    startDate: course.startDate ? toDateString(course.startDate) : null,
    endDate: course.endDate ? toDateString(course.endDate) : null,
  };
}
