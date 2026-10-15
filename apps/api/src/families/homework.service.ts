import { Injectable } from '@nestjs/common';
import type { Homework, HomeworkTask } from '@prisma/client';
import type {
  CreateHomeworkInput,
  HomeworkResponse,
  HomeworkTaskResponse,
  HomeworkTaskStatus,
} from '@ribat/shared';
import type { AuditContext } from '../audit/audit-context';
import { AuditService } from '../audit/audit.service';
import type { OrgContext } from '../auth/org-context.guard';
import { conflict, forbidden, notFound } from '../common/errors';
import { fromDateString, toDateString } from '../common/zoned-time';
import { memberName } from '../courses/course.mapper';
import { emit } from '../events/emit';
import { PrismaService } from '../prisma/prisma.service';
import { ClassScopeService } from '../progress/class-scope.service';

function toHomeworkResponse(row: Homework & { tasks: Pick<HomeworkTask, 'status'>[] }): HomeworkResponse {
  const counts = { ASSIGNED: 0, DONE: 0, MISSED: 0 };
  for (const t of row.tasks) counts[t.status] += 1;
  return {
    id: row.id,
    courseId: row.courseId,
    targetType: row.targetType,
    groupId: row.groupId,
    memberId: row.memberId,
    title: row.title,
    description: row.description,
    dueDate: toDateString(row.dueDate),
    createdByMemberId: row.createdByMemberId,
    createdAt: row.createdAt.toISOString(),
    counts,
  };
}

/** T405, decision 10.2: staff for any target; a teacher for their own course, group or student. */
@Injectable()
export class HomeworkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly scope: ClassScopeService,
  ) {}

  async create(org: OrgContext, audit: AuditContext, input: CreateHomeworkInput): Promise<HomeworkResponse> {
    if (!org.memberId) throw forbidden('Your account has no member profile');
    const scope = await this.scope.forCourse(org, input.courseId, 'write');
    const db = this.prisma.forOrganization(org.organizationId);

    let enrollmentIds: string[];
    if (input.targetType === 'MEMBER') {
      const enrollment = await db.enrollment.findFirst({
        where: { courseId: input.courseId, memberId: input.memberId!, status: 'ACTIVE' },
      });
      if (!enrollment) throw notFound('Enrollment');
      await this.scope.assertStudent(org, scope, enrollment.id);
      enrollmentIds = [enrollment.id];
    } else if (input.targetType === 'GROUP') {
      const group = await db.courseGroup.findFirst({ where: { id: input.groupId!, courseId: input.courseId } });
      if (!group) throw notFound('Group');
      if (scope.groupIds && !scope.groupIds.includes(group.id)) throw forbidden('This is not your group');
      const members = await db.groupMember.findMany({
        where: { groupId: group.id, enrollment: { status: 'ACTIVE' } },
        select: { enrollmentId: true },
      });
      enrollmentIds = [...new Set(members.map((m) => m.enrollmentId))];
    } else {
      // A teacher with groups reaches only their own students, even for a course-wide task.
      const rows = await db.enrollment.findMany({ where: this.scope.enrollmentFilter(scope), select: { id: true } });
      enrollmentIds = rows.map((r) => r.id);
    }
    if (enrollmentIds.length === 0) throw conflict('Nobody to assign this to');

    const row = await db.$transaction(async (tx) => {
      const homework = await tx.homework.create({
        data: {
          organizationId: org.organizationId,
          courseId: input.courseId,
          targetType: input.targetType,
          groupId: input.groupId ?? null,
          memberId: input.memberId ?? null,
          title: input.title,
          description: input.description ?? null,
          dueDate: fromDateString(input.dueDate),
          createdByMemberId: org.memberId!,
        },
      });
      // Expanded now, so a family's list is one indexed query (§9).
      await tx.homeworkTask.createMany({
        data: enrollmentIds.map((enrollmentId) => ({
          organizationId: org.organizationId,
          homeworkId: homework.id,
          enrollmentId,
        })),
      });
      await this.audit.record(
        audit,
        {
          action: 'homework.assigned',
          entityType: 'homework',
          entityId: homework.id,
          after: { courseId: input.courseId, targetType: input.targetType, tasks: enrollmentIds.length },
        },
        tx,
      );
      await emit(tx, audit, {
        type: 'homework.assigned',
        aggregateType: 'homework',
        aggregateId: homework.id,
        payload: { homeworkId: homework.id, courseId: input.courseId, tasks: enrollmentIds.length },
      });
      return tx.homework.findFirstOrThrow({ where: { id: homework.id }, include: { tasks: true } });
    });
    return toHomeworkResponse(row);
  }

  async list(org: OrgContext, courseId: string): Promise<HomeworkResponse[]> {
    await this.scope.forCourse(org, courseId, 'read');
    const rows = await this.prisma.forOrganization(org.organizationId).homework.findMany({
      where: { courseId },
      include: { tasks: { select: { status: true } } },
      orderBy: { dueDate: 'desc' },
      take: 100,
    });
    return rows.map(toHomeworkResponse);
  }

  async tasks(org: OrgContext, homeworkId: string): Promise<HomeworkTaskResponse[]> {
    const db = this.prisma.forOrganization(org.organizationId);
    const homework = await db.homework.findFirst({ where: { id: homeworkId } });
    if (!homework) throw notFound('Homework');
    const scope = await this.scope.forCourse(org, homework.courseId, 'read');
    const tasks = await db.homeworkTask.findMany({
      where: {
        homeworkId,
        ...(scope.groupIds
          ? { enrollmentId: { in: (await db.enrollment.findMany({ where: this.scope.enrollmentFilter(scope), select: { id: true } })).map((e) => e.id) } }
          : {}),
      },
    });
    const enrollments = await db.enrollment.findMany({
      where: { id: { in: tasks.map((t) => t.enrollmentId) } },
      include: { member: true },
    });
    const byId = new Map(enrollments.map((e) => [e.id, e]));
    return tasks
      .map((t) => {
        const e = byId.get(t.enrollmentId)!;
        return {
          id: t.id,
          homeworkId: t.homeworkId,
          enrollmentId: t.enrollmentId,
          memberId: e.memberId,
          memberName: memberName(e.member),
          status: t.status,
          markedAt: t.markedAt?.toISOString() ?? null,
        };
      })
      .sort((a, b) => a.memberName.localeCompare(b.memberName));
  }

  /** "Mark homework done": staff, or the teacher of that student's group. */
  async mark(org: OrgContext, audit: AuditContext, taskId: string, status: HomeworkTaskStatus): Promise<void> {
    const db = this.prisma.forOrganization(org.organizationId);
    const task = await db.homeworkTask.findFirst({ where: { id: taskId }, include: { homework: true } });
    if (!task) throw notFound('Task');
    const scope = await this.scope.forCourse(org, task.homework.courseId, 'write');
    await this.scope.assertStudent(org, scope, task.enrollmentId);
    await db.homeworkTask.updateMany({
      where: { id: taskId },
      data: { status, markedByMemberId: org.memberId, markedAt: new Date() },
    });
    await this.audit.record(audit, {
      action: 'homework.marked',
      entityType: 'homework_task',
      entityId: taskId,
      before: { status: task.status },
      after: { status },
    });
  }
}
