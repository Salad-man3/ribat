import { courseSessionWindow } from './course-window';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('courseSessionWindow', () => {
  it('uses program dates when the halaqa is linked', () => {
    expect(
      courseSessionWindow(
        {
          programId: 'p1',
          startDate: d('2020-01-01'),
          endDate: d('2020-12-31'),
        },
        { startDate: d('2026-09-01'), endDate: d('2027-06-01') },
      ),
    ).toEqual({ startDate: '2026-09-01', endDate: '2027-06-01' });
  });

  it('falls back to course dates without a program', () => {
    expect(
      courseSessionWindow(
        {
          programId: null,
          startDate: d('2026-01-01'),
          endDate: d('2026-06-01'),
        },
        null,
      ),
    ).toEqual({ startDate: '2026-01-01', endDate: '2026-06-01' });
  });
});
