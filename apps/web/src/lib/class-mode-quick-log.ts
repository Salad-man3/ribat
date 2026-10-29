import type { MemorizationSummaryResponse } from '@ribat/shared';
import {
  continuationRangeFromPosition,
  isValidAyahRangeState,
  toAyahRangeInput,
} from './hifz-range-shortcuts';
import { enqueue } from '../offline/outbox';

type QuickLogTarget = {
  memberId: string;
  courseId: string;
  materialId: string;
  materialKind: string;
  position?: MemorizationSummaryResponse;
};

/** One tap after attendance: today's continuation range with a default grade. */
export async function quickMemorizationLog(target: QuickLogTarget): Promise<boolean> {
  const { memberId, courseId, materialId, materialKind, position } = target;
  if (materialKind === 'QURAN') {
    const range = continuationRangeFromPosition(position);
    if (!isValidAyahRangeState(range)) return false;
    await enqueue({
      type: 'memorization.log',
      payload: {
        memberId,
        materialId,
        courseId,
        type: 'NEW',
        range: toAyahRangeInput(range),
        grade: 'GOOD',
        countsProgress: true,
        mistakes: 0,
      },
    });
    return true;
  }
  const page = Math.max(1, (position?.lastPageReached ?? 0) + 1);
  await enqueue({
    type: 'memorization.log',
    payload: {
      memberId,
      materialId,
      courseId,
      type: 'NEW',
      pageFrom: page,
      pageTo: page,
      grade: 'GOOD',
      countsProgress: true,
      mistakes: 0,
    },
  });
  return true;
}
