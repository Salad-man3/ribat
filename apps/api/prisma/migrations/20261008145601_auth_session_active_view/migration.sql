-- CreateEnum
CREATE TYPE "ActiveView" AS ENUM ('ADMIN', 'MEMBER');

-- AlterTable
ALTER TABLE "AuthSession" ADD COLUMN     "activeView" "ActiveView" NOT NULL DEFAULT 'ADMIN';
