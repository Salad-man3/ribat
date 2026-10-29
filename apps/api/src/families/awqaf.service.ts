import { Injectable } from '@nestjs/common';
import type { AwqafExamLevel } from '@prisma/client';
import type { AwqafExamResponse, CreateAwqafExamInput } from '@ribat/shared';
import type { AuditContext } from '../audit/audit-context';
import { AuditService } from '../audit/audit.service';
import type { OrgContext } from '../auth/org-context.guard';
import { forbidden, notFound } from '../common/errors';
import { isStaffContext } from '../progress/class-scope.service';
import { MemberAccessService } from './member-access.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AwqafService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MemberAccessService,
    private readonly audit: AuditService,
  ) {}

  async list(org: OrgContext, memberId: string): Promise<AwqafExamResponse[]> {
    await this.access.relation(org, memberId);
    const db = this.prisma.forOrganization(org.organizationId);
    const rows = await db.awqafExam.findMany({
      where: { memberId },
      include: { juzResults: true },
      orderBy: { takenAt: 'desc' },
    });
    return rows.map(mapExam);
  }

  async create(
    org: OrgContext,
    audit: AuditContext,
    memberId: string,
    input: CreateAwqafExamInput,
    now = new Date(),
  ): Promise<AwqafExamResponse> {
    if (!isStaffContext(org)) throw forbidden('Only staff record Awqaf exams');
    if (!org.memberId) throw forbidden('Your account has no member profile');
    await this.access.relation(org, memberId);
    const db = this.prisma.forOrganization(org.organizationId);
    await db.member.findFirstOrThrow({ where: { id: memberId } });

    const takenAt = input.takenAt ? new Date(input.takenAt) : now;
    const attemptNo =
      (await db.awqafExam.count({
        where: { memberId, level: input.level as AwqafExamLevel },
      })) + 1;

    const row = await db.$transaction(async (tx) => {
      const exam = await tx.awqafExam.create({
        data: {
          organizationId: org.organizationId,
          memberId,
          level: input.level as AwqafExamLevel,
          takenAt,
          attemptNo,
          notes: input.notes ?? null,
          recorderMemberId: org.memberId!,
          juzResults: {
            create: input.juzResults.map((j) => ({
              organizationId: org.organizationId,
              juz: j.juz,
              passed: j.passed,
              score: j.score ?? null,
            })),
          },
        },
        include: { juzResults: true },
      });
      await this.audit.record(
        audit,
        {
          action: 'awqaf.exam.recorded',
          entityType: 'awqaf_exam',
          entityId: exam.id,
          after: { memberId, level: exam.level, attemptNo },
        },
        tx,
      );
      return exam;
    });
    return mapExam(row);
  }
}

function mapExam(row: {
  id: string;
  memberId: string;
  level: AwqafExamLevel;
  takenAt: Date;
  attemptNo: number;
  notes: string | null;
  recorderMemberId: string;
  juzResults: { juz: number; passed: boolean; score: number | null }[];
}): AwqafExamResponse {
  return {
    id: row.id,
    memberId: row.memberId,
    level: row.level,
    takenAt: row.takenAt.toISOString(),
    attemptNo: row.attemptNo,
    notes: row.notes,
    recorderMemberId: row.recorderMemberId,
    juzResults: row.juzResults.map((j) => ({
      juz: j.juz,
      passed: j.passed,
      score: j.score,
    })),
  };
}
