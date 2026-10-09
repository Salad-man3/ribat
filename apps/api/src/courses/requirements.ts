import type { EnrollmentWarning, RequirementType } from '@ribat/shared';

export type RequirementRow = {
  type: RequirementType;
  value: { years?: number; courseId?: string };
  description: string | null;
};

export type RequirementCheckInput = {
  birthDate: string;
  /** Age is judged on the course start date, or today if the course has started. */
  onDate: string;
  course: {
    minAge: number | null;
    maxAge: number | null;
    capacity: number | null;
  };
  requirements: RequirementRow[];
  activeEnrollments: number;
  completedCourseIds: Set<string>;
  courseNames: Map<string, string>;
};

export function ageOn(birthDate: string, onDate: string): number {
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [y, m, d] = onDate.split('-').map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

/** Decision 4.1: every rule produces a warning for staff; none blocks the enrollment. */
export function checkRequirements(
  input: RequirementCheckInput,
): EnrollmentWarning[] {
  const warnings: EnrollmentWarning[] = [];
  const age = ageOn(input.birthDate, input.onDate);

  const minAges = [
    input.course.minAge,
    ...input.requirements
      .filter((r) => r.type === 'MIN_AGE')
      .map((r) => r.value.years),
  ];
  const maxAges = [
    input.course.maxAge,
    ...input.requirements
      .filter((r) => r.type === 'MAX_AGE')
      .map((r) => r.value.years),
  ];
  const min = Math.max(
    ...minAges.filter((v): v is number => typeof v === 'number'),
  );
  const max = Math.min(
    ...maxAges.filter((v): v is number => typeof v === 'number'),
  );
  if (Number.isFinite(min) && age < min) {
    warnings.push({
      code: 'MIN_AGE',
      message: `Age ${age} is below the minimum of ${min}`,
    });
  }
  if (Number.isFinite(max) && age > max) {
    warnings.push({
      code: 'MAX_AGE',
      message: `Age ${age} is above the maximum of ${max}`,
    });
  }

  for (const r of input.requirements) {
    if (
      r.type === 'COMPLETED_COURSE' &&
      r.value.courseId &&
      !input.completedCourseIds.has(r.value.courseId)
    ) {
      const name =
        input.courseNames.get(r.value.courseId) ?? 'a required course';
      warnings.push({
        code: 'COMPLETED_COURSE',
        message: `Has not completed ${name}`,
      });
    }
    if (r.type === 'MANUAL') {
      warnings.push({
        code: 'MANUAL',
        message: r.description ?? 'Check this requirement by hand',
      });
    }
  }

  if (
    input.course.capacity !== null &&
    input.activeEnrollments >= input.course.capacity
  ) {
    warnings.push({
      code: 'CAPACITY',
      message: `The course is full (${input.course.capacity})`,
    });
  }
  return warnings;
}
