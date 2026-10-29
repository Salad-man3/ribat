import { Injectable } from '@nestjs/common';
import type {
  CreateRecitationKindInput,
  RecitationKindResponse,
} from '@ribat/shared';
import type { AuditContext } from '../audit/audit-context';
import { AuditService } from '../audit/audit.service';
import { conflict, notFound } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RecitationKindsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(organizationId: string): Promise<RecitationKindResponse[]> {
    const db = this.prisma.forOrganization(organizationId);
    const rows = await db.recitationKind.findMany({
      where: { archivedAt: null },
      orderBy: { name: 'asc' },
    });
    return rows.map(mapKind);
  }

  async create(
    organizationId: string,
    input: CreateRecitationKindInput,
    audit: AuditContext,
  ): Promise<RecitationKindResponse> {
    const db = this.prisma.forOrganization(organizationId);
    try {
      const row = await db.recitationKind.create({
        data: { organizationId, name: input.name.trim() },
      });
      await this.audit.record(audit, {
        action: 'recitation_kind.created',
        entityType: 'recitation_kind',
        entityId: row.id,
        after: { name: row.name },
      });
      return mapKind(row);
    } catch {
      throw conflict('A recitation kind with this name already exists');
    }
  }

  async archive(
    organizationId: string,
    kindId: string,
    audit: AuditContext,
  ): Promise<RecitationKindResponse> {
    const db = this.prisma.forOrganization(organizationId);
    const existing = await db.recitationKind.findFirst({ where: { id: kindId } });
    if (!existing) throw notFound('Recitation kind');
    const row = await db.recitationKind.update({
      where: { id: kindId },
      data: { active: false, archivedAt: new Date() },
    });
    await this.audit.record(audit, {
      action: 'recitation_kind.archived',
      entityType: 'recitation_kind',
      entityId: kindId,
    });
    return mapKind(row);
  }
}

function mapKind(row: {
  id: string;
  name: string;
  active: boolean;
}): RecitationKindResponse {
  return { id: row.id, name: row.name, active: row.active };
}
