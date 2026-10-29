-- CreateEnum
CREATE TYPE "AwqafExamLevel" AS ENUM ('AJZA_3', 'AJZA_5', 'AJZA_10', 'AJZA_15', 'KHATMAH');

-- CreateTable
CREATE TABLE "RecitationKind" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMPTZ(6),

    CONSTRAINT "RecitationKind_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwqafExam" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "level" "AwqafExamLevel" NOT NULL,
    "takenAt" TIMESTAMPTZ(6) NOT NULL,
    "attemptNo" INTEGER NOT NULL,
    "notes" TEXT,
    "recorderMemberId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AwqafExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwqafExamJuz" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "examId" UUID NOT NULL,
    "juz" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "score" INTEGER,

    CONSTRAINT "AwqafExamJuz_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "MemorizationLog" ADD COLUMN "recitationKindId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "RecitationKind_organizationId_name_key" ON "RecitationKind"("organizationId", "name");

-- CreateIndex
CREATE INDEX "AwqafExam_organizationId_memberId_takenAt_idx" ON "AwqafExam"("organizationId", "memberId", "takenAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "AwqafExamJuz_examId_juz_key" ON "AwqafExamJuz"("examId", "juz");

-- CreateIndex
CREATE INDEX "AwqafExamJuz_organizationId_juz_idx" ON "AwqafExamJuz"("organizationId", "juz");

-- AddForeignKey
ALTER TABLE "RecitationKind" ADD CONSTRAINT "RecitationKind_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorizationLog" ADD CONSTRAINT "MemorizationLog_recitationKindId_fkey" FOREIGN KEY ("recitationKindId") REFERENCES "RecitationKind"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwqafExam" ADD CONSTRAINT "AwqafExam_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwqafExam" ADD CONSTRAINT "AwqafExam_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwqafExam" ADD CONSTRAINT "AwqafExam_recorderMemberId_fkey" FOREIGN KEY ("recorderMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwqafExamJuz" ADD CONSTRAINT "AwqafExamJuz_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwqafExamJuz" ADD CONSTRAINT "AwqafExamJuz_examId_fkey" FOREIGN KEY ("examId") REFERENCES "AwqafExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
