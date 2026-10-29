-- CreateEnum
CREATE TYPE "CustomFieldEntityType" AS ENUM ('MEMBER', 'COURSE', 'PROGRAM', 'MATERIAL');

-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'BOOLEAN');

-- CreateTable
CREATE TABLE "CustomFieldDefinition" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "entityType" "CustomFieldEntityType" NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "CustomFieldType" NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMPTZ(6),

    CONSTRAINT "CustomFieldDefinition_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Member" ADD COLUMN "customValues" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Course" ADD COLUMN "customValues" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Program" ADD COLUMN "customValues" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Material" ADD COLUMN "customValues" JSONB NOT NULL DEFAULT '{}';

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldDefinition_organizationId_entityType_key_key" ON "CustomFieldDefinition"("organizationId", "entityType", "key");

-- CreateIndex
CREATE INDEX "CustomFieldDefinition_organizationId_entityType_archivedAt_idx" ON "CustomFieldDefinition"("organizationId", "entityType", "archivedAt");

-- AddForeignKey
ALTER TABLE "CustomFieldDefinition" ADD CONSTRAINT "CustomFieldDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
