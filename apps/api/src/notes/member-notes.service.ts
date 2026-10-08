import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateMemberNoteInput, MemberNoteResponse, S1Permission } from '@ribat/shared';
import type { AuditContext } from '../audit/audit-context';
import { AuditService } from '../audit/audit.service';
import type { OrgContext } from '../auth/org-context.guard';
import { PrismaService } from '../prisma/prisma.service';

function notFound(): NotFoundException {
  return new NotFoundException({
    error: { code: 'NOT_FOUND', message: 'Member not found' },
  });
}

@Injectable()
export class MemberNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(organizationId: string, memberId: string, org: OrgContext): Promise<MemberNoteResponse[]> {
    const member = await this.prisma.forOrganization(organizationId).member.findFirst({
      where: { id: memberId, status: 'ACTIVE' },
    });
    if (!member) throw notFound();

    if (org.role === 'GUARDIAN' || org.role === 'MEMBER') {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'Forbidden' },
      });
    }

    const canReadAll = org.permissions.includes('notes.read_all' as S1Permission);
    const rows = await this.prisma.forOrganization(organizationId).memberNote.findMany({
      where: {
        memberId,
        ...(canReadAll || !org.memberId
          ? {}
          : { authorMemberId: org.memberId }),
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map(toNoteResponse);
  }

  async create(
    organizationId: string,
    memberId: string,
    org: OrgContext,
    input: CreateMemberNoteInput,
    auditCtx: AuditContext,
  ): Promise<MemberNoteResponse> {
    if (!org.permissions.includes('notes.write' as S1Permission)) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'Forbidden' },
      });
    }
    if (!org.memberId) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'Staff member profile required' },
      });
    }

    const member = await this.prisma.forOrganization(organizationId).member.findFirst({
      where: { id: memberId, status: 'ACTIVE' },
    });
    if (!member) throw notFound();

    // ponytail: teacher-to-own-students check waits for S2 course assignments.

    const row = await this.prisma.forOrganization(organizationId).memberNote.create({
      data: {
        organizationId,
        memberId,
        authorMemberId: org.memberId,
        body: input.body,
        visibility: input.visibility,
        courseId: input.courseId ?? null,
      },
    });

    await this.audit.record(auditCtx, {
      action: 'member_note.created',
      entityType: 'member_note',
      entityId: row.id,
      after: { memberId: row.memberId, visibility: row.visibility },
    });

    return toNoteResponse(row);
  }
}

function toNoteResponse(row: {
  id: string;
  organizationId: string;
  memberId: string;
  courseId: string | null;
  authorMemberId: string;
  body: string;
  visibility: MemberNoteResponse['visibility'];
  createdAt: Date;
}): MemberNoteResponse {
  return {
    id: row.id,
    organizationId: row.organizationId,
    memberId: row.memberId,
    courseId: row.courseId,
    authorMemberId: row.authorMemberId,
    body: row.body,
    visibility: row.visibility,
    createdAt: row.createdAt.toISOString(),
  };
}
