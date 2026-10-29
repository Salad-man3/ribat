-- CreateEnum
CREATE TYPE "StatsScopeType" AS ENUM ('ORG', 'COURSE', 'TEACHER', 'MEMBER');

-- CreateEnum
CREATE TYPE "ReportCardStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "StatsDaily" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "scopeType" "StatsScopeType" NOT NULL,
    "scopeId" UUID NOT NULL,
    "metrics" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "StatsDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportCard" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "courseId" UUID,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "content" JSONB NOT NULL,
    "teacherComment" TEXT,
    "status" "ReportCardStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMPTZ(6),
    "createdByMembershipId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ReportCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StatsDaily_organizationId_date_scopeType_idx" ON "StatsDaily"("organizationId", "date", "scopeType");

-- CreateIndex
CREATE UNIQUE INDEX "StatsDaily_organizationId_date_scopeType_scopeId_key" ON "StatsDaily"("organizationId", "date", "scopeType", "scopeId");

-- CreateIndex
CREATE INDEX "ReportCard_organizationId_status_createdAt_idx" ON "ReportCard"("organizationId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ReportCard_organizationId_memberId_idx" ON "ReportCard"("organizationId", "memberId");

-- AddForeignKey
ALTER TABLE "StatsDaily" ADD CONSTRAINT "StatsDaily_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'REPORT_CARD';
