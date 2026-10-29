import { describe, expect, it, vi, beforeEach } from 'vitest';
import { quickMemorizationLog } from './class-mode-quick-log';

vi.mock('../offline/outbox', () => ({
  enqueue: vi.fn().mockResolvedValue(undefined),
}));

import { enqueue } from '../offline/outbox';

describe('quickMemorizationLog', () => {
  beforeEach(() => {
    vi.mocked(enqueue).mockClear();
  });

  it('queues a quran continuation log with default grade', async () => {
    const ok = await quickMemorizationLog({
      memberId: 'm1',
      courseId: 'c1',
      materialId: 'mat1',
      materialKind: 'QURAN',
      position: { lastSurah: 1, lastAyah: 5, lastPageReached: 1 } as never,
    });
    expect(ok).toBe(true);
    expect(enqueue).toHaveBeenCalledOnce();
    const call = vi.mocked(enqueue).mock.calls[0]![0];
    expect(call.type).toBe('memorization.log');
    expect(call).toMatchObject({
      type: 'memorization.log',
      payload: expect.objectContaining({ grade: 'GOOD', range: expect.anything() }),
    });
  });
});
