import { describe, expect, it } from 'vitest';
import { canEditHistorySession, isHistorySession } from './session-mode';

describe('session-mode', () => {
  it('detects history sessions', () => {
    expect(isHistorySession('2026-01-01', '2026-01-02')).toBe(true);
    expect(isHistorySession('2026-01-02', '2026-01-02')).toBe(false);
  });

  it('lets staff edit any past session', () => {
    expect(canEditHistorySession('2020-01-01', '2026-01-02', true)).toBe(true);
  });

  it('limits teachers to the edit window', () => {
    expect(canEditHistorySession('2026-01-01', '2026-01-02', false)).toBe(true);
    expect(canEditHistorySession('2025-12-01', '2026-01-02', false)).toBe(
      false,
    );
  });
});
