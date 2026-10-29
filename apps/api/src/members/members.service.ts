import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateMemberInput,
  ListMembersQuery,
  MemberCourseSummary,
  MemberResponse,
  UpdateMemberInput,
} from '@ribat/shared';
import type { AuditContext } from '../audit/audit-context';
import { memberAuditDelta, memberAuditSnapshot } from '../audit/audit-snapshots';
import { AuditService } from '../audit/audit.service';
import { HouseholdsService } from '../households/households.service';
import { toDateString } from '../common/zoned-time';
import { PrismaService } from '../prisma/prisma.service';
import { shapeMember } from './member-shaping';
import { toMemberResponse } from './member.mapper';
import type { OrgContext } from '../auth/org-context.guard';
import { CustomFieldsService } from '../custom-fields/custom-fields.service';
import { MembersRepository } from './members.repository';
import { TagsService } from '../tags/tags.service';

@Injectable()
export class MembersService {
    constructor(
        private readonly membersRepository: MembersRepository,
        private readonly audit: AuditService,
        private readonly households: HouseholdsService,
        private readonly prisma: PrismaService,
        private readonly customFields: CustomFieldsService,
        private readonly tags: TagsService,
    ) { }

    private async withTags(
        organizationId: string,
        org: OrgContext,
        members: MemberResponse[],
    ): Promise<MemberResponse[]> {
        if (!org.permissions.includes('members.manage')) return members;
        const map = await this.tags.tagIdsByMember(
            organizationId,
            members.map((m) => m.id),
        );
        return members.map((m) => ({
            ...m,
            tagIds: map.get(m.id) ?? [],
        }));
    }

    async create(
        organizationId: string,
        input: CreateMemberInput,
        auditCtx: AuditContext,
    ): Promise<MemberResponse> {
        const { customValues: customPatch, tagIds, ...rest } = input;
        const customValues =
            customPatch === undefined
                ? {}
                : await this.customFields.sanitizeForCreate(
                      organizationId,
                      'MEMBER',
                      customPatch,
                  );
        const member = await this.membersRepository.create(organizationId, {
            ...rest,
            customValues,
        });
        if (tagIds !== undefined) {
            await this.tags.setMemberTags(organizationId, member.id, tagIds);
        }
        await this.audit.record(auditCtx, {
            action: 'member.created',
            entityType: 'member',
            entityId: member.id,
            after: memberAuditSnapshot(member),
        });
        const response = toMemberResponse(member);
        if (tagIds !== undefined) {
            response.tagIds = tagIds;
        }
        return response;
    }

    async list(
        organizationId: string,
        query: ListMembersQuery,
        org: OrgContext,
    ): Promise<MemberResponse[]> {
        const members = await this.membersRepository.list(organizationId, query);
        if (!query.includeCourses) {
            return this.withTags(
                organizationId,
                org,
                members.map((member) => shapeMember(member, org)),
            );
        }
        const ids = members.map((m) => m.id);
        const db = this.prisma.forOrganization(organizationId);
        const [enrollments, assignments] = await Promise.all([
            db.enrollment.findMany({
                where: { memberId: { in: ids }, status: 'ACTIVE' },
                include: { course: true },
            }),
            db.teachingAssignment.findMany({
                where: { teacherMemberId: { in: ids } },
                include: { course: true },
                orderBy: [{ endedAt: { sort: 'desc', nulls: 'first' } }, { createdAt: 'asc' }],
            }),
        ]);
        const studying = new Map<string, MemberCourseSummary[]>();
        const teaching = new Map<string, MemberCourseSummary[]>();
        for (const row of enrollments) {
            const list = studying.get(row.memberId) ?? [];
            list.push({
                courseId: row.courseId,
                courseName: row.course.name,
            });
            studying.set(row.memberId, list);
        }
        for (const row of assignments) {
            const list = teaching.get(row.teacherMemberId) ?? [];
            list.push({
                courseId: row.courseId,
                courseName: row.course.name,
                endedAt: row.endedAt ? toDateString(row.endedAt) : null,
            });
            teaching.set(row.teacherMemberId, list);
        }
        return this.withTags(
            organizationId,
            org,
            members.map((member) => ({
                ...shapeMember(member, org),
                studying: studying.get(member.id) ?? [],
                teaching: teaching.get(member.id) ?? [],
            })),
        );
    }

    async getById(organizationId: string, id: string, org: OrgContext): Promise<MemberResponse> {
        const member = await this.membersRepository.findById(organizationId, id);
        if (!member) {
            throw new NotFoundException({
                error: { code: 'NOT_FOUND', message: 'Member not found' },
            });
        }
        const siblingMemberIds = await this.households.siblingIds(
            organizationId,
            member.id,
            member.householdId,
        );
        const [withTag] = await this.withTags(organizationId, org, [
            { ...shapeMember(member, org), siblingMemberIds },
        ]);
        return withTag;
    }

    async update(
        organizationId: string,
        id: string,
        input: UpdateMemberInput,
        auditCtx: AuditContext,
    ): Promise<MemberResponse> {
        const before = await this.membersRepository.findById(organizationId, id);
        if (!before) {
            throw new NotFoundException({
                error: { code: 'NOT_FOUND', message: 'Member not found' },
            });
        }
        const { customValues: customPatch, tagIds, ...rest } = input;
        const patch =
            customPatch === undefined
                ? rest
                : {
                      ...rest,
                      customValues: await this.customFields.sanitizeForUpdate(
                          organizationId,
                          'MEMBER',
                          before.customValues,
                          customPatch,
                      ),
                  };
        if (tagIds !== undefined) {
            await this.tags.setMemberTags(organizationId, id, tagIds);
        }
        const member = await this.membersRepository.update(organizationId, id, patch);
        if (!member || !before) {
            throw new NotFoundException({
                error: { code: 'NOT_FOUND', message: 'Member not found' },
            });
        }
        const delta = memberAuditDelta(before, member);
        if (delta) {
            await this.audit.record(auditCtx, {
                action: 'member.updated',
                entityType: 'member',
                entityId: member.id,
                before: delta.before,
                after: delta.after,
            });
        }
        const response = toMemberResponse(member);
        if (tagIds !== undefined) {
            response.tagIds = tagIds;
        } else {
            response.tagIds = await this.tags.tagIdsForMember(organizationId, id);
        }
        return response;
    }

    async archive(
        organizationId: string,
        id: string,
        auditCtx: AuditContext,
    ): Promise<MemberResponse> {
        const before = await this.membersRepository.findById(organizationId, id);
        const member = await this.membersRepository.archive(organizationId, id, auditCtx);
        if (!member || !before) {
            throw new NotFoundException({
                error: { code: 'NOT_FOUND', message: 'Member not found' },
            });
        }
        const delta = memberAuditDelta(before, member);
        await this.audit.record(auditCtx, {
            action: 'member.archived',
            entityType: 'member',
            entityId: member.id,
            before: delta?.before ?? memberAuditSnapshot(before),
            after: delta?.after ?? memberAuditSnapshot(member),
        });
        return toMemberResponse(member);
    }
}