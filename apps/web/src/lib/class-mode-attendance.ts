import type { AttendanceStatus } from '@ribat/shared';
import { enqueue } from '../offline/outbox';

export type AttendanceMarkState = AttendanceStatus | 'none';

/** Queue Present for this session only when the student has no mark yet. */
export async function presentIfUnmarked(
  sessionId: string,
  enrollmentId: string,
  current: AttendanceMarkState,
): Promise<void> {
  if (current !== 'none') return;
  await enqueue({
    type: 'attendance.mark',
    payload: { sessionId, enrollmentId, status: 'PRESENT' },
  });
}
