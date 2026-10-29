import { Injectable } from '@nestjs/common';
import type { CustomFieldEntityType } from '@prisma/client';
import {
  customFieldKeyFromLabel,
  sanitizeCustomValues,
  type CreateCustomFieldInput,
  type CustomFieldDefinitionResponse,
  type CustomValues,
  type ListCustomFieldsQuery,
  type UpdateCustomFieldInput,
} from '@ribat/shared';
import { notFound } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { storedCustomValues } from './stored-custom-values';

function toDefinitionResponse(row: {
  id: string;
  organizationId: string;
  entityType: CustomFieldEntityType;
  key: string;
  label: string;
  type: 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN';
  createdAt: Date;
  archivedAt: Date | null;
}): CustomFieldDefinitionResponse {
  return {
    id: row.id,
    organizationId: row.organizationId,
    entityType: row.entityType,
    key: row.key,
    label: row.label,
    type: row.type,
    createdAt: row.createdAt.toISOString(),
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
  };
}

@Injectable()
export class CustomFieldsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    organizationId: string,
    query: ListCustomFieldsQuery,
  ): Promise<CustomFieldDefinitionResponse[]> {
    const rows = await this.prisma
      .forOrganization(organizationId)
      .customFieldDefinition.findMany({
        where: {
          ...(query.entityType ? { entityType: query.entityType } : {}),
        },
        orderBy: [{ entityType: 'asc' }, { label: 'asc' }],
      });
    return rows.map(toDefinitionResponse);
  }

  async create(
    organizationId: string,
    input: CreateCustomFieldInput,
  ): Promise<CustomFieldDefinitionResponse> {
    const db = this.prisma.forOrganization(organizationId);
    const baseKey = customFieldKeyFromLabel(input.label);
    for (let attempt = 0; attempt < 5; attempt++) {
      const key = attempt === 0 ? baseKey : `${baseKey}_${attempt + 1}`;
      try {
        const row = await db.customFieldDefinition.create({
          data: {
            organizationId,
            entityType: input.entityType,
            key,
            label: input.label.trim(),
            type: input.type,
          },
        });
        return toDefinitionResponse(row);
      } catch (error) {
        const code =
          error && typeof error === 'object' && 'code' in error
            ? (error as { code: string }).code
            : '';
        if (code !== 'P2002') throw error;
      }
    }
    throw new Error('Could not allocate custom field key');
  }

  async update(
    organizationId: string,
    id: string,
    input: UpdateCustomFieldInput,
  ): Promise<CustomFieldDefinitionResponse> {
    const db = this.prisma.forOrganization(organizationId);
    const result = await db.customFieldDefinition.updateMany({
      where: { id, archivedAt: null },
      data: { label: input.label.trim() },
    });
    if (result.count === 0) throw notFound('Custom field');
    const row = await db.customFieldDefinition.findFirst({ where: { id } });
    if (!row) throw notFound('Custom field');
    return toDefinitionResponse(row);
  }

  async archive(
    organizationId: string,
    id: string,
  ): Promise<CustomFieldDefinitionResponse> {
    const db = this.prisma.forOrganization(organizationId);
    const result = await db.customFieldDefinition.updateMany({
      where: { id, archivedAt: null },
      data: { archivedAt: new Date() },
    });
    if (result.count === 0) throw notFound('Custom field');
    const row = await db.customFieldDefinition.findFirst({ where: { id } });
    if (!row) throw notFound('Custom field');
    return toDefinitionResponse(row);
  }

  async activeDefinitions(
    organizationId: string,
    entityType: CustomFieldEntityType,
  ) {
    return this.prisma.forOrganization(organizationId).customFieldDefinition.findMany({
      where: { entityType, archivedAt: null },
      select: { key: true, type: true },
    });
  }

  async sanitizeForCreate(
    organizationId: string,
    entityType: CustomFieldEntityType,
    input: unknown,
  ): Promise<CustomValues> {
    const defs = await this.activeDefinitions(organizationId, entityType);
    return sanitizeCustomValues(defs, input);
  }

  async sanitizeForUpdate(
    organizationId: string,
    entityType: CustomFieldEntityType,
    existing: unknown,
    patch: unknown,
  ): Promise<CustomValues> {
    const defs = await this.activeDefinitions(organizationId, entityType);
    const merged = {
      ...storedCustomValues(existing),
      ...(patch && typeof patch === 'object' && !Array.isArray(patch)
        ? (patch as Record<string, unknown>)
        : {}),
    };
    return sanitizeCustomValues(defs, merged);
  }
}
