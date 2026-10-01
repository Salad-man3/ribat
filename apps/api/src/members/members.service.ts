import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateMemberInput, ListMembersQuery, MemberResponse, UpdateMemberInput } from '@ribat/shared';
import { toMemberResponse } from './member.mapper';
import { MembersRepository } from './members.repository';

@Injectable()
export class MembersService {
    constructor(private readonly membersRepository: MembersRepository) { }

    async create(organizationId: string, input: CreateMemberInput): Promise<MemberResponse> {
        const member = await this.membersRepository.create(organizationId, input);
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
        return toMemberResponse(member);
    }

    async update(
        organizationId: string,
        id: string,
        input: UpdateMemberInput,
    ): Promise<MemberResponse> {
        const member = await this.membersRepository.update(organizationId, id, input);
        if (!member) {
            throw new NotFoundException({
                error: { code: 'NOT_FOUND', message: 'Member not found' },
            });
        }
        return toMemberResponse(member);
    }

    async archive(organizationId: string, id: string): Promise<MemberResponse> {
        const member = await this.membersRepository.archive(organizationId, id);
        if (!member) {
            throw new NotFoundException({
                error: { code: 'NOT_FOUND', message: 'Member not found' },
            });
        }
        return toMemberResponse(member);
    }
}