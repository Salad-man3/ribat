import { describe, expect, it } from 'vitest';
import { lobbyWeekDates, weekBoundsSaturdayFirst } from './domain';

describe('weekBoundsSaturdayFirst', () => {
  it('starts on Saturday and runs seven days', () => {
    // 2026-10-26 is Monday UTC
    const { from, to } = weekBoundsSaturdayFirst('2026-10-26');
    expect(from).toBe('2026-10-24');
    expect(to).toBe('2026-10-30');
    const days = lobbyWeekDates(from);
    expect(days).toHaveLength(7);
    expect(days[0].weekday).toBe(6);
    expect(days[0].date).toBe('2026-10-24');
    expect(days[6].weekday).toBe(5);
  });
});
