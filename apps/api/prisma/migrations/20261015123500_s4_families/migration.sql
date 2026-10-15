-- CreateEnum
CREATE TYPE "ExcuseStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "HomeworkTarget" AS ENUM ('COURSE', 'GROUP', 'MEMBER');

-- CreateEnum
CREATE TYPE "HomeworkTaskStatus" AS ENUM ('ASSIGNED', 'DONE', 'MISSED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ABSENCE_SUMMARY', 'ATTENDANCE_OVERRIDDEN', 'TEST_RESULT', 'HOMEWORK_ASSIGNED', 'HOMEWORK_MISSED', 'SCHEDULE_CHANGE', 'EXCUSE_DECIDED', 'SESSION_NOT_TAKEN');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'DONE', 'FAILED', 'DEAD');

-- CreateTable
CREATE TABLE "ExcuseRequest" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "courseId" UUID,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "submittedByIdentityId" UUID NOT NULL,
    "status" "ExcuseStatus" NOT NULL DEFAULT 'PENDING',
    "decidedByMembershipId" UUID,
    "decidedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExcuseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Homework" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "targetType" "HomeworkTarget" NOT NULL,
    "groupId" UUID,
    "memberId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" DATE NOT NULL,
    "createdByMemberId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Homework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkTask" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "homeworkId" UUID NOT NULL,
    "enrollmentId" UUID NOT NULL,
    "status" "HomeworkTaskStatus" NOT NULL DEFAULT 'ASSIGNED',
    "markedByMemberId" UUID,
    "markedAt" TIMESTAMPTZ(6),

    CONSTRAINT "HomeworkTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "recipientIdentityId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "titleKey" TEXT NOT NULL,
    "bodyKey" TEXT NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "entityType" TEXT,
    "entityId" UUID,
    "dedupeKey" TEXT NOT NULL,
    "readAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainEvent" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "requestId" TEXT,
    "actorMembershipId" UUID,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatchedAt" TIMESTAMPTZ(6),

    CONSTRAINT "DomainEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventDelivery" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "handler" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextAttemptAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExcuseRequest_organizationId_status_idx" ON "ExcuseRequest"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ExcuseRequest_organizationId_memberId_fromDate_idx" ON "ExcuseRequest"("organizationId", "memberId", "fromDate");

-- CreateIndex
CREATE INDEX "Homework_organizationId_courseId_dueDate_idx" ON "Homework"("organizationId", "courseId", "dueDate");

-- CreateIndex
CREATE INDEX "HomeworkTask_enrollmentId_status_idx" ON "HomeworkTask"("enrollmentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HomeworkTask_homeworkId_enrollmentId_key" ON "HomeworkTask"("homeworkId", "enrollmentId");

-- CreateIndex
CREATE INDEX "Notification_recipientIdentityId_readAt_createdAt_idx" ON "Notification"("recipientIdentityId", "readAt", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Notification_organizationId_dedupeKey_key" ON "Notification"("organizationId", "dedupeKey");

-- CreateIndex
CREATE INDEX "DomainEvent_dispatchedAt_occurredAt_idx" ON "DomainEvent"("dispatchedAt", "occurredAt");

-- CreateIndex
CREATE INDEX "DomainEvent_organizationId_type_occurredAt_idx" ON "DomainEvent"("organizationId", "type", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "EventDelivery_status_idx" ON "EventDelivery"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EventDelivery_eventId_handler_key" ON "EventDelivery"("eventId", "handler");

-- AddForeignKey
ALTER TABLE "ExcuseRequest" ADD CONSTRAINT "ExcuseRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkTask" ADD CONSTRAINT "HomeworkTask_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkTask" ADD CONSTRAINT "HomeworkTask_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainEvent" ADD CONSTRAINT "DomainEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDelivery" ADD CONSTRAINT "EventDelivery_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "DomainEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
