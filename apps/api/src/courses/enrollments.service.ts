import { Injectable } from '@nestjs/common';
import type { CourseRequirement, Enrollment, Member } from '@prisma/client';
import type {
  CreateRequirementInput,
  EnrollmentResponse,
  EnrollResult,
  RequirementResponse,
} from '@ribat/shared';
import type { AuditContext } from '../audit/audit-context';
import { AuditService } from '../audit/audit.service';
import { notFound } from '../common/errors';
import { dateIn, fromDateString, toDateString } from '../common/zoned-time';
import { PrismaService } from '../prisma/prisma.service';
import { CourseAccessService } from './course-access.service';
import { memberName } from './course.mapper';
import { checkRequirements, type RequirementRow } from './requirements';

function toEnrollmentResponse(
  row: Enrollment & { member: Member },
): EnrollmentResponse {
  return {
    id: row.id,
    courseId: row.courseId,
    memberId: row.memberId,
    memberName: memberName(row.member),
    status: row.status,
    startedAt: toDateString(row.startedAt),
    endedAt: row.endedAt ? toDateString(row.endedAt) : null,
  };
}

function requirementValue(row: CourseRequirement): RequirementRow['value'] {
  return typeof row.value === 'object' &&
    row.value !== null &&
    !Array.isArray(row.value)
    ? (row.value as RequirementRow['value'])
    : {};
}

function toRequirementResponse(row: CourseRequirement): RequirementResponse {
  const value = requirementValue(row);
  return {
    id: row.id,
    courseId: row.courseId,
    type: row.type,
    years: value.years ?? null,
    requiredCourseId: value.courseId ?? null,
    description: row.description,
  };
}

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: CourseAccessService,
  ) {}

  private async today(organizationId: string): Promise<string> {
    const org = await this.prisma.platform.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    return dateIn(new Date(), org.timezone);
  }

  // -------------------------------------------------------------------------
  // Requirements (T203)
  // -------------------------------------------------------------------------

  async listRequirements(
    organizationId: string,
    courseId: string,
  ): Promise<RequirementResponse[]> {
    await this.access.find(organizationId, courseId);
    const rows = await this.prisma
      .forOrganization(organizationId)
      .courseRequirement.findMany({
        where: { courseId },
      });
    return rows.map(toRequirementResponse);
  }

  async addRequirement(
    organizationId: string,
    courseId: string,
    input: CreateRequirementInput,
    auditCtx: AuditContext,
  ): Promise<RequirementResponse> {
    await this.access.writable(organizationId, courseId);
    const db = this.prisma.forOrganization(organizationId);
    if (input.type === 'COMPLETED_COURSE') {
      // The prerequisite must be a course of this organization.
      await this.access.find(organizationId, input.courseId);
    }
    const value =
      input.type === 'MIN_AGE' || input.type === 'MAX_AGE'
        ? { years: input.years }
        : input.type === 'COMPLETED_COURSE'
          ? { courseId: input.courseId }
          : {};
    const row = await db.courseRequirement.create({
      data: {
        organizationId,
        courseId,
        type: input.type,
        value,
        description: input.description,
      },
    });
    await this.audit.record(auditCtx, {
      action: 'requirement.added',
      entityType: 'course',
      entityId: courseId,
      after: toRequirementResponse(row),
    });
    return toRequirementResponse(row);
  }

  async removeRequirement(
    organizationId: string,
    courseId: string,
    requirementId: string,
    auditCtx: AuditContext,
  ): Promise<void> {
    await this.access.writable(organizationId, courseId);
    const db = this.prisma.forOrganization(organizationId);
    const row = await db.courseRequirement.findFirst({
      where: { id: requirementId, courseId },
    });
    if (!row) throw notFound('Requirement');
    await db.courseRequirement.deleteMany({ where: { id: row.id } });
    await this.audit.record(auditCtx, {
      action: 'requirement.removed',
      entityType: 'course',
      entityId: courseId,
      before: toRequirementResponse(row),
    });
  }

  // -------------------------------------------------------------------------
  // Enrollment (T204, DM-05)
  // -------------------------------------------------------------------------

  async list(
    organizationId: string,
    courseId: string,
  ): Promise<EnrollmentResponse[]> {
    const rows = await this.prisma
      .forOrganization(organizationId)
      .enrollment.findMany({
        where: { courseId },
        include: { member: true },
        orderBy: [
          { status: 'asc' },
          { member: { familyName: 'asc' } },
          { member: { firstName: 'asc' } },
        ],
      });
    return rows.map(toEnrollmentResponse);
  }

  /** Staff only (decision 4.4). Re-enrolling a withdrawn member reactivates the same row. */
  async enroll(
    organizationId: string,
    courseId: string,
    memberId: string,
    auditCtx: AuditContext,
  ): Promise<EnrollResult> {
    const course = await this.access.writable(organizationId, courseId);
    const db = this.prisma.forOrganization(organizationId);
    const member = await db.member.findFirst({
      where: { id: memberId, status: 'ACTIVE' },
    });
    if (!member) throw notFound('Member');

    const today = await this.today(organizationId);
    const [requirements, activeEnrollments, completed] = await Promise.all([
      db.courseRequirement.findMany({ where: { courseId } }),
      db.enrollment.count({
        where: { courseId, status: 'ACTIVE', memberId: { not: memberId } },
      }),
      db.enrollment.findMany({
        where: { memberId, status: 'COMPLETED' },
        select: { courseId: true },
      }),
    ]);
    const prerequisiteIds = requirements
      .map((r) => requirementValue(r).courseId)
      .filter((id): id is string => typeof id === 'string');
    const prerequisites = prerequisiteIds.length
      ? await db.course.findMany({
          where: { id: { in: prerequisiteIds } },
          select: { id: true, name: true },
        })
      : [];
    const startDate = course.startDate ? toDateString(course.startDate) : null;

    const warnings = checkRequirements({
      birthDate: toDateString(member.birthDate),
      onDate: startDate && startDate > today ? startDate : today,
      course,
      requirements: requirements.map((r) => ({
        type: r.type,
        value: requirementValue(r),
        description: r.description,
      })),
      activeEnrollments,
      completedCourseIds: new Set(completed.map((c) => c.courseId)),
      courseNames: new Map(prerequisites.map((c) => [c.id, c.name])),
    });

    const existing = await db.enrollment.findFirst({
      where: { courseId, memberId },
    });
    if (existing) {
      await db.enrollment.updateMany({
        where: { id: existing.id },
        data: {
          status: 'ACTIVE',
          startedAt: fromDateString(today),
          endedAt: null,
        },
      });
    } else {
      await db.enrollment.create({
        data: {
          organizationId,
          courseId,
          memberId,
          startedAt: fromDateString(today),
        },
      });
    }
    const row = await db.enrollment.findFirstOrThrow({
      where: { courseId, memberId },
      include: { member: true },
    });
    await this.audit.record(auditCtx, {
      action: 'enrollment.created',
      entityType: 'enrollment',
      entityId: row.id,
      after: { courseId, memberId, warnings: warnings.map((w) => w.code) },
    });
    return { enrollment: toEnrollmentResponse(row), warnings };
  }

  /** Withdrawing keeps the row (history) and takes the student out of every group. */
  async withdraw(
    organizationId: string,
    courseId: string,
    enrollmentId: string,
    auditCtx: AuditContext,
  ): Promise<void> {
    await this.access.writable(organizationId, courseId);
    const db = this.prisma.forOrganization(organizationId);
    const row = await db.enrollment.findFirst({
      where: { id: enrollmentId, courseId, status: 'ACTIVE' },
    });
    if (!row) throw notFound('Enrollment');
    const today = await this.today(organizationId);
    await db.$transaction(async (tx) => {
      await tx.groupMember.deleteMany({ where: { enrollmentId } });
      await tx.enrollment.updateMany({
        where: { id: enrollmentId },
        data: { status: 'WITHDRAWN', endedAt: fromDateString(today) },
      });
    });
    await this.audit.record(auditCtx, {
      action: 'enrollment.withdrawn',
      entityType: 'enrollment',
      entityId: enrollmentId,
      before: { courseId, memberId: row.memberId },
    });
  }
}
