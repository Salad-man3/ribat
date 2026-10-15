-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- CreateEnum
CREATE TYPE "WriteSource" AS ENUM ('ONLINE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "MemorizationType" AS ENUM ('NEW', 'REVISION', 'INITIAL');

-- CreateEnum
CREATE TYPE "Grade" AS ENUM ('EXCELLENT', 'VERY_GOOD', 'GOOD', 'REPEAT');

-- CreateEnum
CREATE TYPE "TestScope" AS ENUM ('JUZ', 'SURAH', 'RANGE', 'TEXT_PAGES');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('APPLIED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "Attendance" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "enrollmentId" UUID NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "markedByMemberId" UUID NOT NULL,
    "markedAt" TIMESTAMPTZ(6) NOT NULL,
    "source" "WriteSource" NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "supersededCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemorizationLog" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "materialId" UUID NOT NULL,
    "courseId" UUID,
    "type" "MemorizationType" NOT NULL,
    "surahStart" INTEGER,
    "ayahStart" INTEGER,
    "surahEnd" INTEGER,
    "ayahEnd" INTEGER,
    "pageFrom" INTEGER NOT NULL,
    "pageTo" INTEGER NOT NULL,
    "ayahCount" INTEGER,
    "grade" "Grade",
    "mistakes" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "loggedByMemberId" UUID NOT NULL,
    "loggedAt" TIMESTAMPTZ(6) NOT NULL,
    "source" "WriteSource" NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "voidedAt" TIMESTAMPTZ(6),
    "voidedByMemberId" UUID,
    "voidReason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemorizationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemorizationTest" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "materialId" UUID NOT NULL,
    "courseId" UUID,
    "scopeType" "TestScope" NOT NULL,
    "juz" INTEGER,
    "surahStart" INTEGER,
    "ayahStart" INTEGER,
    "surahEnd" INTEGER,
    "ayahEnd" INTEGER,
    "pageFrom" INTEGER,
    "pageTo" INTEGER,
    "score" INTEGER NOT NULL,
    "passMark" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "attemptNo" INTEGER NOT NULL,
    "examinerMemberId" UUID NOT NULL,
    "takenAt" TIMESTAMPTZ(6) NOT NULL,
    "notes" TEXT,
    "idempotencyKey" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemorizationTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemorizationSummary" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "materialId" UUID NOT NULL,
    "pagesMemorized" INTEGER NOT NULL,
    "ayahsMemorized" INTEGER NOT NULL,
    "lastPageReached" INTEGER,
    "lastSurah" INTEGER,
    "lastAyah" INTEGER,
    "lastLoggedAt" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "MemorizationSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialLog" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "materialId" UUID NOT NULL,
    "groupId" UUID,
    "pageFrom" INTEGER NOT NULL,
    "pageTo" INTEGER NOT NULL,
    "note" TEXT,
    "loggedByMemberId" UUID NOT NULL,
    "loggedAt" TIMESTAMPTZ(6) NOT NULL,
    "source" "WriteSource" NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncMutation" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncMutation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attendance_enrollmentId_markedAt_idx" ON "Attendance"("enrollmentId", "markedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_sessionId_enrollmentId_key" ON "Attendance"("sessionId", "enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_organizationId_idempotencyKey_key" ON "Attendance"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "MemorizationLog_organizationId_memberId_loggedAt_idx" ON "MemorizationLog"("organizationId", "memberId", "loggedAt" DESC);

-- CreateIndex
CREATE INDEX "MemorizationLog_courseId_loggedAt_idx" ON "MemorizationLog"("courseId", "loggedAt" DESC);

-- CreateIndex
CREATE INDEX "MemorizationLog_materialId_memberId_idx" ON "MemorizationLog"("materialId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "MemorizationLog_organizationId_idempotencyKey_key" ON "MemorizationLog"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "MemorizationTest_organizationId_memberId_takenAt_idx" ON "MemorizationTest"("organizationId", "memberId", "takenAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "MemorizationTest_organizationId_idempotencyKey_key" ON "MemorizationTest"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "MemorizationSummary_organizationId_idx" ON "MemorizationSummary"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "MemorizationSummary_memberId_materialId_key" ON "MemorizationSummary"("memberId", "materialId");

-- CreateIndex
CREATE INDEX "MaterialLog_sessionId_idx" ON "MaterialLog"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialLog_organizationId_idempotencyKey_key" ON "MaterialLog"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "SyncMutation_organizationId_idempotencyKey_key" ON "SyncMutation"("organizationId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CourseSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_markedByMemberId_fkey" FOREIGN KEY ("markedByMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorizationLog" ADD CONSTRAINT "MemorizationLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorizationLog" ADD CONSTRAINT "MemorizationLog_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorizationLog" ADD CONSTRAINT "MemorizationLog_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorizationLog" ADD CONSTRAINT "MemorizationLog_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorizationLog" ADD CONSTRAINT "MemorizationLog_loggedByMemberId_fkey" FOREIGN KEY ("loggedByMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorizationTest" ADD CONSTRAINT "MemorizationTest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorizationTest" ADD CONSTRAINT "MemorizationTest_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorizationTest" ADD CONSTRAINT "MemorizationTest_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorizationTest" ADD CONSTRAINT "MemorizationTest_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorizationTest" ADD CONSTRAINT "MemorizationTest_examinerMemberId_fkey" FOREIGN KEY ("examinerMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorizationSummary" ADD CONSTRAINT "MemorizationSummary_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorizationSummary" ADD CONSTRAINT "MemorizationSummary_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorizationSummary" ADD CONSTRAINT "MemorizationSummary_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialLog" ADD CONSTRAINT "MaterialLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialLog" ADD CONSTRAINT "MaterialLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CourseSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialLog" ADD CONSTRAINT "MaterialLog_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialLog" ADD CONSTRAINT "MaterialLog_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CourseGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialLog" ADD CONSTRAINT "MaterialLog_loggedByMemberId_fkey" FOREIGN KEY ("loggedByMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncMutation" ADD CONSTRAINT "SyncMutation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
