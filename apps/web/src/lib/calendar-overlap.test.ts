import { describe, expect, it } from 'vitest';
import { overlapColumns } from './calendar-overlap';

describe('overlapColumns', () => {
  it('places overlapping blocks in different columns', () => {
    const cols = overlapColumns([
      {
        id: 'a',
        startsAt: '2026-01-01T10:00:00Z',
        endsAt: '2026-01-01T11:00:00Z',
      },
      {
        id: 'b',
        startsAt: '2026-01-01T10:30:00Z',
        endsAt: '2026-01-01T11:30:00Z',
      },
    ]);
    expect(cols.get('a')).toBe(0);
    expect(cols.get('b')).toBe(1);
  });
});
