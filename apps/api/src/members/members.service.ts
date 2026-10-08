import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateMemberInput, ListMembersQuery, MemberResponse, UpdateMemberInput } from '@ribat/shared';
import type { AuditContext } from '../audit/audit-context';
import { memberAuditDelta, memberAuditSnapshot } from '../audit/audit-snapshots';
import { AuditService } from '../audit/audit.service';
import { HouseholdsService } from '../households/households.service';
import { toMemberResponse } from './member.mapper';
import { MembersRepository } from './members.repository';

@Injectable()
export class MembersService {
    constructor(
        private readonly membersRepository: MembersRepository,
        private readonly audit: AuditService,
        private readonly households: HouseholdsService,
    ) { }

    async create(
        organizationId: string,
        input: CreateMemberInput,
        auditCtx: AuditContext,
    ): Promise<MemberResponse> {
        const member = await this.membersRepository.create(organizationId, input);
        await this.audit.record(auditCtx, {
            action: 'member.created',
            entityType: 'member',
            entityId: member.id,
            after: memberAuditSnapshot(member),
        });
        return toMemberResponse(member);
    }

    async list(organizationId: string, query: ListMembersQuery): Promise<MemberResponse[]> {
        const members = await this.membersRepository.list(organizationId, query);
        return members.map(toMemberResponse);
    }

    async getById(organizationId: string, id: string): Promise<MemberResponse> {
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
        return { ...toMemberResponse(member), siblingMemberIds };
    }

    async update(
        organizationId: string,
        id: string,
        input: UpdateMemberInput,
        auditCtx: AuditContext,
    ): Promise<MemberResponse> {
        const before = await this.membersRepository.findById(organizationId, id);
        const member = await this.membersRepository.update(organizationId, id, input);
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
        return toMemberResponse(member);
    }

    async archive(
        organizationId: string,
        id: string,
        auditCtx: AuditContext,
    ): Promise<MemberResponse> {
        const before = await this.membersRepository.findById(organizationId, id);
        const member = await this.membersRepository.archive(organizationId, id);
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