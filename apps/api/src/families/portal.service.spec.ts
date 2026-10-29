import { attendanceCounts } from './portal.service';

describe('PortalService', () => {
  describe('attendanceCounts', () => {
    it('returns null rate when nothing was marked', () => {
      expect(attendanceCounts([])).toEqual({
        PRESENT: 0,
        ABSENT: 0,
        LATE: 0,
        EXCUSED: 0,
        total: 0,
        rate: null,
      });
    });

    it('counts present and late toward the rate', () => {
      expect(attendanceCounts(['PRESENT', 'LATE', 'ABSENT'])).toMatchObject({
        PRESENT: 1,
        LATE: 1,
        ABSENT: 1,
        total: 3,
        rate: 2 / 3,
      });
    });
  });
});
