-- CreateEnum
CREATE TYPE "StudyStatus" AS ENUM ('SCHOOL', 'UNIVERSITY', 'NOT_STUDYING');

-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('NONE', 'PRIMARY', 'MIDDLE', 'SECONDARY', 'DIPLOMA', 'BACHELOR', 'MASTER', 'DOCTORATE');

-- AlterEnum
ALTER TYPE "MemorizationType" ADD VALUE 'TEST';

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "faculty" TEXT,
ADD COLUMN     "highestEducation" "EducationLevel",
ADD COLUMN     "studyStatus" "StudyStatus",
ADD COLUMN     "university" TEXT,
ADD COLUMN     "universityYear" INTEGER;

-- Backfill: anyone with school details is a school student.
UPDATE "Member" SET "studyStatus" = 'SCHOOL' WHERE "schoolGrade" IS NOT NULL OR "schoolName" IS NOT NULL;
