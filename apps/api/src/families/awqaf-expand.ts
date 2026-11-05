import type { AwqafExamLevel } from '@prisma/client';

export type AwqafExamForMap = {
  level: AwqafExamLevel;
  juzFrom: number;
  juzTo: number;
  passed: boolean;
  score: number | null;
  takenAt: Date;
};

/** Per-juz rows for the hifz map — one sitting, same outcome on each juz in the range. */
export function expandAwqafByJuz(exam: AwqafExamForMap) {
  const rows: {
    juz: number;
    passed: boolean;
    score: number | null;
    level: AwqafExamLevel;
    takenAt: string;
  }[] = [];
  for (let juz = exam.juzFrom; juz <= exam.juzTo; juz++) {
    rows.push({
      juz,
      passed: exam.passed,
      score: exam.score,
      level: exam.level,
      takenAt: exam.takenAt.toISOString(),
    });
  }
  return rows;
}
