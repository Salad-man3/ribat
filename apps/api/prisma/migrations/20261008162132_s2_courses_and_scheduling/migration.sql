-- CreateEnum
CREATE TYPE "MaterialKind" AS ENUM ('QURAN', 'TEXT', 'BOOK');

-- CreateEnum
CREATE TYPE "MaterialTrack" AS ENUM ('MEMORIZATION', 'EXPLANATION');

-- CreateEnum
CREATE TYPE "CourseType" AS ENUM ('MEMORIZATION', 'EXPLANATION', 'BOTH');

-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'FINISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RequirementType" AS ENUM ('MIN_AGE', 'MAX_AGE', 'COMPLETED_COURSE', 'MANUAL');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'WITHDRAWN', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TeachingRole" AS ENUM ('LEAD', 'TEACHER');

-- CreateEnum
CREATE TYPE "TimeAnchor" AS ENUM ('FIXED', 'PRAYER');

-- CreateEnum
CREATE TYPE "Prayer" AS ENUM ('FAJR', 'SUNRISE', 'DHUHR', 'ASR', 'MAGHRIB', 'ISHA');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('SCHEDULED', 'HELD', 'CANCELLED');

-- CreateTable
CREATE TABLE "Material" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "kind" "MaterialKind" NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "totalPages" INTEGER,
    "url" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMPTZ(6),

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "CourseType" NOT NULL,
    "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" DATE,
    "endDate" DATE,
    "location" TEXT,
    "minAge" INTEGER,
    "maxAge" INTEGER,
    "capacity" INTEGER,
    "isHierarchical" BOOLEAN NOT NULL DEFAULT false,
    "hasGroups" BOOLEAN NOT NULL DEFAULT false,
    "testPassMark" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseMaterial" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "materialId" UUID NOT NULL,
    "track" "MaterialTrack" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CourseMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseRequirement" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "type" "RequirementType" NOT NULL,
    "value" JSONB NOT NULL DEFAULT '{}',
    "description" TEXT,

    CONSTRAINT "CourseRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" DATE NOT NULL,
    "endedAt" DATE,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeachingAssignment" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "teacherMemberId" UUID NOT NULL,
    "role" "TeachingRole" NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMPTZ(6),

    CONSTRAINT "TeachingAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseGroup" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "teacherMemberId" UUID NOT NULL,
    "materialId" UUID,
    "materialKey" TEXT NOT NULL,

    CONSTRAINT "CourseGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "materialKey" TEXT NOT NULL,
    "enrollmentId" UUID NOT NULL,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseSchedule" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startAnchor" "TimeAnchor" NOT NULL,
    "startTime" TEXT,
    "startPrayer" "Prayer",
    "startOffsetMin" INTEGER NOT NULL DEFAULT 0,
    "endAnchor" "TimeAnchor" NOT NULL,
    "endTime" TEXT,
    "endPrayer" "Prayer",
    "endOffsetMin" INTEGER NOT NULL DEFAULT 0,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,

    CONSTRAINT "CourseSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoursePause" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "reason" TEXT,

    CONSTRAINT "CoursePause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseSession" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "startsAt" TIMESTAMPTZ(6) NOT NULL,
    "endsAt" TIMESTAMPTZ(6) NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "topic" TEXT,
    "scheduleId" UUID,
    "isException" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CourseSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Material_organizationId_archivedAt_idx" ON "Material"("organizationId", "archivedAt");

-- CreateIndex
CREATE INDEX "Course_organizationId_status_idx" ON "Course"("organizationId", "status");

-- CreateIndex
CREATE INDEX "CourseMaterial_organizationId_idx" ON "CourseMaterial"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseMaterial_courseId_materialId_key" ON "CourseMaterial"("courseId", "materialId");

-- CreateIndex
CREATE INDEX "CourseRequirement_organizationId_courseId_idx" ON "CourseRequirement"("organizationId", "courseId");

-- CreateIndex
CREATE INDEX "Enrollment_organizationId_memberId_idx" ON "Enrollment"("organizationId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_courseId_memberId_key" ON "Enrollment"("courseId", "memberId");

-- CreateIndex
CREATE INDEX "TeachingAssignment_organizationId_teacherMemberId_idx" ON "TeachingAssignment"("organizationId", "teacherMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "TeachingAssignment_courseId_teacherMemberId_key" ON "TeachingAssignment"("courseId", "teacherMemberId");

-- CreateIndex
CREATE INDEX "CourseGroup_organizationId_courseId_idx" ON "CourseGroup"("organizationId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseGroup_id_materialKey_key" ON "CourseGroup"("id", "materialKey");

-- CreateIndex
CREATE INDEX "GroupMember_groupId_idx" ON "GroupMember"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_enrollmentId_materialKey_key" ON "GroupMember"("enrollmentId", "materialKey");

-- CreateIndex
CREATE INDEX "CourseSchedule_organizationId_courseId_idx" ON "CourseSchedule"("organizationId", "courseId");

-- CreateIndex
CREATE INDEX "CoursePause_organizationId_courseId_idx" ON "CoursePause"("organizationId", "courseId");

-- CreateIndex
CREATE INDEX "CourseSession_organizationId_date_idx" ON "CourseSession"("organizationId", "date");

-- CreateIndex
CREATE INDEX "CourseSession_courseId_date_idx" ON "CourseSession"("courseId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CourseSession_courseId_date_startsAt_key" ON "CourseSession"("courseId", "date", "startsAt");

-- AddForeignKey
ALTER TABLE "MemberNote" ADD CONSTRAINT "MemberNote_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseMaterial" ADD CONSTRAINT "CourseMaterial_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseMaterial" ADD CONSTRAINT "CourseMaterial_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseMaterial" ADD CONSTRAINT "CourseMaterial_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRequirement" ADD CONSTRAINT "CourseRequirement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRequirement" ADD CONSTRAINT "CourseRequirement_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_teacherMemberId_fkey" FOREIGN KEY ("teacherMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseGroup" ADD CONSTRAINT "CourseGroup_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseGroup" ADD CONSTRAINT "CourseGroup_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseGroup" ADD CONSTRAINT "CourseGroup_teacherMemberId_fkey" FOREIGN KEY ("teacherMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseGroup" ADD CONSTRAINT "CourseGroup_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_materialKey_fkey" FOREIGN KEY ("groupId", "materialKey") REFERENCES "CourseGroup"("id", "materialKey") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSchedule" ADD CONSTRAINT "CourseSchedule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSchedule" ADD CONSTRAINT "CourseSchedule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursePause" ADD CONSTRAINT "CoursePause_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursePause" ADD CONSTRAINT "CoursePause_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSession" ADD CONSTRAINT "CourseSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSession" ADD CONSTRAINT "CourseSession_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSession" ADD CONSTRAINT "CourseSession_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "CourseSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written: rules Prisma cannot express.
-- ---------------------------------------------------------------------------

-- One QURAN catalogue row per organization.
CREATE UNIQUE INDEX "Material_one_quran_per_org" ON "Material"("organizationId") WHERE "kind" = 'QURAN';

-- DM-06: materialKey mirrors materialId so the composite FK on GroupMember
-- carries the group's material, and (enrollmentId, materialKey) is unique.
ALTER TABLE "CourseGroup" ADD CONSTRAINT "CourseGroup_materialKey_check"
  CHECK ("materialKey" = COALESCE("materialId"::text, 'ALL'));

ALTER TABLE "CourseSchedule" ADD CONSTRAINT "CourseSchedule_weekday_check"
  CHECK ("weekday" BETWEEN 0 AND 6);

ALTER TABLE "CoursePause" ADD CONSTRAINT "CoursePause_range_check"
  CHECK ("fromDate" <= "toDate");

-- Backfill the Quran for organizations created before S2.
INSERT INTO "Material" ("id", "organizationId", "kind", "title", "totalPages")
SELECT gen_random_uuid(), o."id", 'QURAN', 'القرآن الكريم', 604
FROM "Organization" o
WHERE NOT EXISTS (
  SELECT 1 FROM "Material" m WHERE m."organizationId" = o."id" AND m."kind" = 'QURAN'
);
