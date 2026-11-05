import { beforeEach, describe, expect, it, vi } from 'vitest';
import { presentIfUnmarked } from './class-mode-attendance';

vi.mock('../offline/outbox', () => ({
  enqueue: vi.fn().mockResolvedValue(undefined),
}));

import { enqueue } from '../offline/outbox';

describe('presentIfUnmarked', () => {
  beforeEach(() => {
    vi.mocked(enqueue).mockClear();
  });

  it('enqueues PRESENT when unmarked', async () => {
    await presentIfUnmarked('sess1', 'enr1', 'none');
    expect(enqueue).toHaveBeenCalledWith({
      type: 'attendance.mark',
      payload: { sessionId: 'sess1', enrollmentId: 'enr1', status: 'PRESENT' },
    });
  });

  it('does not enqueue when already marked', async () => {
    await presentIfUnmarked('sess1', 'enr1', 'LATE');
    await presentIfUnmarked('sess1', 'enr1', 'ABSENT');
    expect(enqueue).not.toHaveBeenCalled();
  });
});
