-- CreateEnum
CREATE TYPE "JoinApplicationKind" AS ENUM ('STUDENT', 'GUARDIAN');

-- CreateEnum
CREATE TYPE "JoinApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "JoinApplication" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "kind" "JoinApplicationKind" NOT NULL,
    "status" "JoinApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "phone" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "fatherName" TEXT NOT NULL,
    "familyName" TEXT NOT NULL,
    "birthDate" DATE,
    "wards" JSONB,
    "decidedAt" TIMESTAMPTZ(6),
    "decidedByMembershipId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JoinApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JoinApplication_organizationId_status_createdAt_idx" ON "JoinApplication"("organizationId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "JoinApplication_organizationId_phone_status_idx" ON "JoinApplication"("organizationId", "phone", "status");

-- AddForeignKey
ALTER TABLE "JoinApplication" ADD CONSTRAINT "JoinApplication_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
