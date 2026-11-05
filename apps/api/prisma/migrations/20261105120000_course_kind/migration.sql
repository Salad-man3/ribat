-- CreateEnum
CREATE TYPE "CourseKind" AS ENUM ('HALAQA', 'ONE_OFF');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN "kind" "CourseKind" NOT NULL DEFAULT 'HALAQA';
