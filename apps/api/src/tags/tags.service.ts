import { Injectable } from '@nestjs/common';
import type {
  CreateTagInput,
  TagResponse,
  UpdateTagInput,
} from '@ribat/shared';
import type { AuditContext } from '../audit/audit-context';
import { AuditService } from '../audit/audit.service';
import { conflict, notFound } from '../common/errors';
import { readOrganizationSettings } from '../organizations/organization.mapper';
import { PrismaService } from '../prisma/prisma.service';
import { toTagResponse } from './tag.mapper';

@Injectable()
export class TagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async tagsEnabled(organizationId: string): Promise<boolean> {
    const org = await this.prisma.platform.organization.findFirst({
      where: { id: organizationId },
      select: { settings: true },
    });
    if (!org) return false;
    return readOrganizationSettings(org.settings).tagsEnabled ?? false;
  }

  async assertTagsEnabled(organizationId: string): Promise<void> {
    if (!(await this.tagsEnabled(organizationId))) {
      throw conflict('TAGS_DISABLED', 'Member tags are not enabled for this mosque');
    }
  }

  async list(organizationId: string): Promise<TagResponse[]> {
    await this.assertTagsEnabled(organizationId);
    const rows = await this.prisma.forOrganization(organizationId).tag.findMany({
      where: { archivedAt: null },
      orderBy: { name: 'asc' },
    });
    return rows.map(toTagResponse);
  }

  async create(
    organizationId: string,
    input: CreateTagInput,
    auditCtx: AuditContext,
  ): Promise<TagResponse> {
    await this.assertTagsEnabled(organizationId);
    const row = await this.prisma.forOrganization(organizationId).tag.create({
      data: {
        organizationId,
        name: input.name.trim(),
        permissions: input.permissions ?? [],
      },
    });
    await this.audit.record(auditCtx, {
      action: 'tag.created',
      entityType: 'tag',
      entityId: row.id,
      after: { name: row.name },
    });
    return toTagResponse(row);
  }

  async update(
    organizationId: string,
    id: string,
    input: UpdateTagInput,
    auditCtx: AuditContext,
  ): Promise<TagResponse> {
    await this.assertTagsEnabled(organizationId);
    const before = await this.findActive(organizationId, id);
    await this.prisma.forOrganization(organizationId).tag.updateMany({
      where: { id, archivedAt: null },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.permissions !== undefined ? { permissions: input.permissions } : {}),
      },
    });
    const after = await this.findActive(organizationId, id);
    await this.audit.record(auditCtx, {
      action: 'tag.updated',
      entityType: 'tag',
      entityId: id,
      before: { name: before.name },
      after: {
        name: after.name,
        ...(input.permissions !== undefined ? { permissions: input.permissions } : {}),
      },
    });
    return toTagResponse(after);
  }

  async archive(
    organizationId: string,
    id: string,
    auditCtx: AuditContext,
  ): Promise<TagResponse> {
    await this.assertTagsEnabled(organizationId);
    const before = await this.findActive(organizationId, id);
    await this.prisma.forOrganization(organizationId).tag.updateMany({
      where: { id, archivedAt: null },
      data: { archivedAt: new Date() },
    });
    await this.prisma.forOrganization(organizationId).memberTag.deleteMany({
      where: { tagId: id },
    });
    const after = await this.prisma.forOrganization(organizationId).tag.findFirst({
      where: { id },
    });
    if (!after) throw notFound('Tag');
    await this.audit.record(auditCtx, {
      action: 'tag.archived',
      entityType: 'tag',
      entityId: id,
      before: { name: before.name },
    });
    return toTagResponse(after);
  }

  /** Replace a member's tag set. Caller must have verified tags are enabled. */
  async setMemberTags(
    organizationId: string,
    memberId: string,
    tagIds: string[],
  ): Promise<string[]> {
    await this.assertTagsEnabled(organizationId);
    const unique = [...new Set(tagIds)];
    if (unique.length > 0) {
      const found = await this.prisma.forOrganization(organizationId).tag.findMany({
        where: { id: { in: unique }, archivedAt: null },
        select: { id: true },
      });
      if (found.length !== unique.length) throw notFound('Tag');
    }
    const db = this.prisma.forOrganization(organizationId);
    await db.$transaction([
      db.memberTag.deleteMany({ where: { memberId } }),
      ...(unique.length
        ? [
            db.memberTag.createMany({
              data: unique.map((tagId) => ({
                organizationId,
                memberId,
                tagId,
              })),
            }),
          ]
        : []),
    ]);
    return unique;
  }

  async tagIdsByMember(organizationId: string, memberIds: string[]): Promise<Map<string, string[]>> {
    if (memberIds.length === 0) return new Map();
    const enabled = await this.tagsEnabled(organizationId);
    if (!enabled) return new Map(memberIds.map((id) => [id, []]));
    const rows = await this.prisma.forOrganization(organizationId).memberTag.findMany({
      where: { memberId: { in: memberIds } },
      select: { memberId: true, tagId: true },
    });
    const map = new Map<string, string[]>();
    for (const id of memberIds) map.set(id, []);
    for (const row of rows) {
      const list = map.get(row.memberId) ?? [];
      list.push(row.tagId);
      map.set(row.memberId, list);
    }
    return map;
  }

  async tagIdsForMember(organizationId: string, memberId: string): Promise<string[]> {
    const map = await this.tagIdsByMember(organizationId, [memberId]);
    return map.get(memberId) ?? [];
  }

  private async findActive(organizationId: string, id: string) {
    const row = await this.prisma.forOrganization(organizationId).tag.findFirst({
      where: { id, archivedAt: null },
    });
    if (!row) throw notFound('Tag');
    return row;
  }
}
