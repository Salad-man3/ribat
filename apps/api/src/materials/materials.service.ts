import { Injectable } from '@nestjs/common';
import type { Material } from '@prisma/client';
import type {
  CreateMaterialInput,
  MaterialResponse,
  UpdateMaterialInput,
} from '@ribat/shared';
import type { AuditContext } from '../audit/audit-context';
import { AuditService } from '../audit/audit.service';
import { conflict, notFound } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { toMaterialResponse } from './material.mapper';

const auditFields = (m: Material) => ({
  kind: m.kind,
  title: m.title,
  author: m.author,
  totalPages: m.totalPages,
  url: m.url,
});

@Injectable()
export class MaterialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(organizationId: string): Promise<MaterialResponse[]> {
    const rows = await this.prisma
      .forOrganization(organizationId)
      .material.findMany({
        where: { archivedAt: null },
        orderBy: [{ kind: 'asc' }, { title: 'asc' }],
      });
    return rows.map(toMaterialResponse);
  }

  async findActive(organizationId: string, id: string): Promise<Material> {
    const row = await this.prisma
      .forOrganization(organizationId)
      .material.findFirst({
        where: { id, archivedAt: null },
      });
    if (!row) throw notFound('Material');
    return row;
  }

  /** OQ-3: a teacher may edit a material used by a course they actively teach. */
  async teachesMaterial(
    organizationId: string,
    memberId: string | null,
    materialId: string,
  ): Promise<boolean> {
    if (!memberId) return false;
    const row = await this.prisma
      .forOrganization(organizationId)
      .courseMaterial.findFirst({
        where: {
          materialId,
          course: {
            teachers: { some: { teacherMemberId: memberId, endedAt: null } },
          },
        },
        select: { id: true },
      });
    return row !== null;
  }

  async create(
    organizationId: string,
    input: CreateMaterialInput,
    auditCtx: AuditContext,
  ): Promise<MaterialResponse> {
    const row = await this.prisma
      .forOrganization(organizationId)
      .material.create({
        data: { organizationId, ...input },
      });
    await this.audit.record(auditCtx, {
      action: 'material.created',
      entityType: 'material',
      entityId: row.id,
      after: auditFields(row),
    });
    return toMaterialResponse(row);
  }

  async update(
    organizationId: string,
    id: string,
    input: UpdateMaterialInput,
    auditCtx: AuditContext,
  ): Promise<MaterialResponse> {
    const before = await this.findActive(organizationId, id);
    if (before.kind === 'QURAN')
      throw conflict('The Quran entry is managed by the system');
    await this.prisma
      .forOrganization(organizationId)
      .material.updateMany({ where: { id }, data: input });
    const after = await this.findActive(organizationId, id);
    await this.audit.record(auditCtx, {
      action: 'material.updated',
      entityType: 'material',
      entityId: id,
      before: auditFields(before),
      after: auditFields(after),
    });
    return toMaterialResponse(after);
  }

  async archive(
    organizationId: string,
    id: string,
    auditCtx: AuditContext,
  ): Promise<MaterialResponse> {
    const before = await this.findActive(organizationId, id);
    if (before.kind === 'QURAN')
      throw conflict('The Quran entry cannot be archived');
    await this.prisma.forOrganization(organizationId).material.updateMany({
      where: { id },
      data: { archivedAt: new Date() },
    });
    const after = await this.prisma
      .forOrganization(organizationId)
      .material.findFirstOrThrow({ where: { id } });
    await this.audit.record(auditCtx, {
      action: 'material.archived',
      entityType: 'material',
      entityId: id,
    });
    return toMaterialResponse(after);
  }
}
