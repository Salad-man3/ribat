import type {
  Attendance,
  MaterialLog,
  MemorizationLog,
  MemorizationSummary,
  MemorizationTest,
} from '@prisma/client';
import type {
  AttendanceResponse,
  AyahRangeInput,
  MaterialLogResponse,
  MemorizationLogResponse,
  MemorizationSummaryResponse,
  MemorizationTestResponse,
} from '@ribat/shared';

type RangeColumns = {
  surahStart: number | null;
  ayahStart: number | null;
  surahEnd: number | null;
  ayahEnd: number | null;
};

function rangeOf(row: RangeColumns): AyahRangeInput | null {
  if (row.surahStart === null) return null;
  return {
    surahStart: row.surahStart,
    ayahStart: row.ayahStart!,
    surahEnd: row.surahEnd!,
    ayahEnd: row.ayahEnd!,
  };
}

export function toAttendanceResponse(row: Attendance): AttendanceResponse {
  return {
    id: row.id,
    sessionId: row.sessionId,
    enrollmentId: row.enrollmentId,
    status: row.status,
    markedByMemberId: row.markedByMemberId,
    markedAt: row.markedAt.toISOString(),
    supersededCount: row.supersededCount,
  };
}

export function toLogResponse(row: MemorizationLog): MemorizationLogResponse {
  return {
    id: row.id,
    memberId: row.memberId,
    materialId: row.materialId,
    courseId: row.courseId,
    type: row.type,
    range: rangeOf(row),
    pageFrom: row.pageFrom,
    pageTo: row.pageTo,
    ayahCount: row.ayahCount,
    grade: row.grade,
    mistakes: row.mistakes,
    note: row.note,
    loggedByMemberId: row.loggedByMemberId,
    loggedAt: row.loggedAt.toISOString(),
    voidedAt: row.voidedAt?.toISOString() ?? null,
    voidReason: row.voidReason,
  };
}

export function toTestResponse(
  row: MemorizationTest,
): MemorizationTestResponse {
  return {
    id: row.id,
    memberId: row.memberId,
    materialId: row.materialId,
    courseId: row.courseId,
    scopeType: row.scopeType,
    juz: row.juz,
    range: rangeOf(row),
    pageFrom: row.pageFrom,
    pageTo: row.pageTo,
    score: row.score,
    passMark: row.passMark,
    passed: row.passed,
    attemptNo: row.attemptNo,
    examinerMemberId: row.examinerMemberId,
    takenAt: row.takenAt.toISOString(),
    notes: row.notes,
  };
}

export function toMaterialLogResponse(row: MaterialLog): MaterialLogResponse {
  return {
    id: row.id,
    sessionId: row.sessionId,
    materialId: row.materialId,
    groupId: row.groupId,
    pageFrom: row.pageFrom,
    pageTo: row.pageTo,
    note: row.note,
    loggedByMemberId: row.loggedByMemberId,
    loggedAt: row.loggedAt.toISOString(),
  };
}

export function toSummaryResponse(
  row: MemorizationSummary,
): MemorizationSummaryResponse {
  return {
    memberId: row.memberId,
    materialId: row.materialId,
    pagesMemorized: row.pagesMemorized,
    ayahsMemorized: row.ayahsMemorized,
    lastPageReached: row.lastPageReached,
    lastSurah: row.lastSurah,
    lastAyah: row.lastAyah,
    lastLoggedAt: row.lastLoggedAt?.toISOString() ?? null,
  };
}
