import { Injectable } from '@nestjs/common';
import type {
  CreateProgramInput,
  ProgramResponse,
  UpdateProgramInput,
} from '@ribat/shared';
import type { AuditContext } from '../audit/audit-context';
import { AuditService } from '../audit/audit.service';
import { notFound } from '../common/errors';
import { fromDateString } from '../common/zoned-time';
import { SessionsQueue } from '../jobs/sessions-queue';
import { CustomFieldsService } from '../custom-fields/custom-fields.service';
import { PrismaService } from '../prisma/prisma.service';
import { toProgramResponse } from './program.mapper';

@Injectable()
export class ProgramsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sessions: SessionsQueue,
    private readonly customFields: CustomFieldsService,
  ) {}

  async list(organizationId: string): Promise<ProgramResponse[]> {
    const rows = await this.prisma.forOrganization(organizationId).program.findMany({
      where: { archivedAt: null },
      orderBy: { name: 'asc' },
    });
    return rows.map(toProgramResponse);
  }

  async create(
    organizationId: string,
    input: CreateProgramInput,
    auditCtx: AuditContext,
  ): Promise<ProgramResponse> {
    const { customValues: customPatch, ...rest } = input;
    const customValues =
      customPatch === undefined
        ? {}
        : await this.customFields.sanitizeForCreate(
            organizationId,
            'PROGRAM',
            customPatch,
          );
    const row = await this.prisma.forOrganization(organizationId).program.create({
      data: {
        organizationId,
        name: rest.name,
        startDate: rest.startDate ? fromDateString(rest.startDate) : undefined,
        endDate: rest.endDate ? fromDateString(rest.endDate) : undefined,
        customValues,
      },
    });
    await this.audit.record(auditCtx, {
      action: 'program.created',
      entityType: 'program',
      entityId: row.id,
      after: toProgramResponse(row),
    });
    return toProgramResponse(row);
  }

  async update(
    organizationId: string,
    id: string,
    input: UpdateProgramInput,
    auditCtx: AuditContext,
  ): Promise<ProgramResponse> {
    const before = await this.find(organizationId, id);
    const { customValues: customPatch, ...rest } = input;
    const customValues =
      customPatch === undefined
        ? undefined
        : await this.customFields.sanitizeForUpdate(
            organizationId,
            'PROGRAM',
            before.customValues,
            customPatch,
          );
    await this.prisma.forOrganization(organizationId).program.updateMany({
      where: { id },
      data: {
        name: rest.name,
        startDate:
          rest.startDate === undefined
            ? undefined
            : rest.startDate
              ? fromDateString(rest.startDate)
              : null,
        endDate:
          rest.endDate === undefined
            ? undefined
            : rest.endDate
              ? fromDateString(rest.endDate)
              : null,
        ...(customValues !== undefined ? { customValues } : {}),
      },
    });
    const after = await this.find(organizationId, id);
    await this.audit.record(auditCtx, {
      action: 'program.updated',
      entityType: 'program',
      entityId: id,
      before: toProgramResponse(before),
      after: toProgramResponse(after),
    });
    if (input.startDate !== undefined || input.endDate !== undefined) {
      const courses = await this.prisma
        .forOrganization(organizationId)
        .course.findMany({
          where: { programId: id },
          select: { id: true },
        });
      await Promise.all(
        courses.map((c) =>
          this.sessions.generateCourse(organizationId, c.id),
        ),
      );
    }
    return toProgramResponse(after);
  }

  async archive(
    organizationId: string,
    id: string,
    auditCtx: AuditContext,
  ): Promise<ProgramResponse> {
    const before = await this.find(organizationId, id);
    await this.prisma.forOrganization(organizationId).program.updateMany({
      where: { id },
      data: { archivedAt: new Date() },
    });
    const after = await this.find(organizationId, id);
    await this.audit.record(auditCtx, {
      action: 'program.archived',
      entityType: 'program',
      entityId: id,
      before: toProgramResponse(before),
      after: toProgramResponse(after),
    });
    return toProgramResponse(after);
  }

  private async find(organizationId: string, id: string) {
    const row = await this.prisma.forOrganization(organizationId).program.findFirst({
      where: { id },
    });
    if (!row) throw notFound('Program');
    return row;
  }
}
