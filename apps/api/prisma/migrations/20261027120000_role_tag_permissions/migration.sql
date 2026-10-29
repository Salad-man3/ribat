-- Drop staff templates; tag permissions; announcement audiences

ALTER TYPE "AnnouncementTargetType" ADD VALUE IF NOT EXISTS 'PROGRAMS';
ALTER TYPE "AnnouncementTargetType" ADD VALUE IF NOT EXISTS 'ROLES';

ALTER TABLE "Tag" ADD COLUMN IF NOT EXISTS "permissions" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "Membership" DROP CONSTRAINT IF EXISTS "Membership_staffRoleId_fkey";
DROP INDEX IF EXISTS "Membership_organizationId_staffRoleId_idx";
ALTER TABLE "Membership" DROP COLUMN IF EXISTS "staffRoleId";

DROP TABLE IF EXISTS "StaffRole";
