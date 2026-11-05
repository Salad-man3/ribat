-- One Awqaf sitting: contiguous juz range + single passed/score on AwqafExam.

ALTER TABLE "AwqafExam" ADD COLUMN "passed" BOOLEAN;
ALTER TABLE "AwqafExam" ADD COLUMN "score" INTEGER;
ALTER TABLE "AwqafExam" ADD COLUMN "juzFrom" INTEGER;
ALTER TABLE "AwqafExam" ADD COLUMN "juzTo" INTEGER;

UPDATE "AwqafExam" e
SET
  "juzFrom" = sub.min_juz,
  "juzTo" = sub.max_juz,
  "passed" = sub.all_passed,
  "score" = sub.max_score
FROM (
  SELECT
    "examId",
    MIN(juz) AS min_juz,
    MAX(juz) AS max_juz,
    BOOL_AND(passed) AS all_passed,
    MAX(score) AS max_score
  FROM "AwqafExamJuz"
  GROUP BY "examId"
) sub
WHERE e.id = sub."examId";

-- Exams with no child rows (should not happen): safe default.
UPDATE "AwqafExam"
SET "juzFrom" = 1, "juzTo" = 1, "passed" = false
WHERE "juzFrom" IS NULL;

ALTER TABLE "AwqafExam" ALTER COLUMN "passed" SET NOT NULL;
ALTER TABLE "AwqafExam" ALTER COLUMN "juzFrom" SET NOT NULL;
ALTER TABLE "AwqafExam" ALTER COLUMN "juzTo" SET NOT NULL;

DROP TABLE "AwqafExamJuz";
