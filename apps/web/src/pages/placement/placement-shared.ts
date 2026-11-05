import { PLACEMENT_UNASSIGNED } from '../../components/HalaqaPickerDialog';

export { PLACEMENT_UNASSIGNED };

export type DragPayload =
  | {
      kind: 'enrolled';
      enrollmentId: string;
      memberId: string;
      memberName: string;
      fromCourseId: string;
    }
  | { kind: 'unassigned'; memberId: string; memberName: string };

export type UndoAction =
  | {
      type: 'move';
      fromCourseId: string;
      toCourseId: string;
      enrollmentId: string;
      memberId: string;
      memberName: string;
    }
  | {
      type: 'withdraw';
      fromCourseId: string;
      enrollmentId: string;
      memberId: string;
      memberName: string;
    }
  | {
      type: 'enroll';
      toCourseId: string;
      memberId: string;
      memberName: string;
    };

export function dragId(payload: DragPayload): string {
  if (payload.kind === 'enrolled') {
    return `e:${payload.enrollmentId}:${payload.memberId}:${payload.fromCourseId}:${payload.memberName}`;
  }
  return `u:${payload.memberId}:${payload.memberName}`;
}

export function dropTargetId(courseOrUnassigned: string): string {
  return courseOrUnassigned === PLACEMENT_UNASSIGNED
    ? PLACEMENT_UNASSIGNED
    : `course:${courseOrUnassigned}`;
}
