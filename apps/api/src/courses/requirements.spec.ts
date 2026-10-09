import {
  ageOn,
  checkRequirements,
  type RequirementCheckInput,
} from './requirements';

const base: RequirementCheckInput = {
  birthDate: '2016-05-10',
  onDate: '2026-10-08',
  course: { minAge: null, maxAge: null, capacity: null },
  requirements: [],
  activeEnrollments: 0,
  completedCourseIds: new Set(),
  courseNames: new Map(),
};

const codes = (input: Partial<RequirementCheckInput>) =>
  checkRequirements({ ...base, ...input }).map((w) => w.code);

describe('checkRequirements (decision 4.1: warn, never block)', () => {
  it('counts age in whole years, birthday-aware', () => {
    expect(ageOn('2016-10-09', '2026-10-08')).toBe(9);
    expect(ageOn('2016-10-08', '2026-10-08')).toBe(10);
  });

  it('warns on course age limits and on age requirement rows', () => {
    expect(
      codes({ course: { minAge: 12, maxAge: null, capacity: null } }),
    ).toEqual(['MIN_AGE']);
    expect(
      codes({
        requirements: [
          { type: 'MAX_AGE', value: { years: 8 }, description: null },
        ],
      }),
    ).toEqual(['MAX_AGE']);
    expect(
      codes({ course: { minAge: 7, maxAge: 12, capacity: null } }),
    ).toEqual([]);
  });

  it('warns when a prerequisite course was not completed', () => {
    const requirements = [
      {
        type: 'COMPLETED_COURSE' as const,
        value: { courseId: 'c1' },
        description: null,
      },
    ];
    expect(codes({ requirements })).toEqual(['COMPLETED_COURSE']);
    expect(
      codes({ requirements, completedCourseIds: new Set(['c1']) }),
    ).toEqual([]);
  });

  it('always surfaces manual conditions and a full course', () => {
    expect(
      codes({
        requirements: [
          {
            type: 'MANUAL',
            value: {},
            description: 'Interview with the sheikh',
          },
        ],
        course: { minAge: null, maxAge: null, capacity: 20 },
        activeEnrollments: 20,
      }),
    ).toEqual(['MANUAL', 'CAPACITY']);
  });
});
