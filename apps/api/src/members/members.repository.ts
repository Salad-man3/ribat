import { Injectable } from '@nestjs/common';
import type { Member, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateMemberInput, ListMembersQuery, UpdateMemberInput } from '@ribat/shared';

@Injectable()
export class MembersRepository {
    constructor(private readonly prisma: PrismaService) { }

    create(organizationId: string, input: CreateMemberInput): Promise<Member> {
        return this.prisma.member.create({
            data: {
                organizationId,
                firstName: input.firstName,
                fatherName: input.fatherName,
                familyName: input.familyName,
                motherName: input.motherName,
                birthDate: new Date(input.birthDate),
                joinedAt: new Date(input.joinedAt),
                phone: input.phone,
                address: input.address,
                schoolGrade: input.schoolGrade,
                schoolName: input.schoolName,
                notes: input.notes,
                householdId: input.householdId,
            },
        });
    }

    findById(organizationId: string, id: string): Promise<Member | null> {
        return this.prisma.member.findFirst({
            where: { id, organizationId },
        });
    }

    list(organizationId: string, query: ListMembersQuery): Promise<Member[]> {
        const where: Prisma.MemberWhereInput = {
            organizationId,
            status: query.status,
        };

        if (query.search) {
            where.OR = [
                { firstName: { contains: query.search, mode: 'insensitive' } },
                { fatherName: { contains: query.search, mode: 'insensitive' } },
                { familyName: { contains: query.search, mode: 'insensitive' } },
            ];
        }

        return this.prisma.member.findMany({
            where,
            orderBy: [{ familyName: 'asc' }, { firstName: 'asc' }],
            take: query.limit,
            ...(query.cursor
                ? {
                    cursor: { id: query.cursor },
                    skip: 1,
                }
                : {}),
        });
    }

    update(organizationId: string, id: string, input: UpdateMemberInput): Promise<Member | null> {
        return this.prisma.member.updateMany({
            where: { id, organizationId, status: 'ACTIVE' },
            data: {
                firstName: input.firstName,
                fatherName: input.fatherName,
                familyName: input.familyName,
                motherName: input.motherName,
                birthDate: input.birthDate ? new Date(input.birthDate) : undefined,
                joinedAt: input.joinedAt ? new Date(input.joinedAt) : undefined,
                phone: input.phone,
                address: input.address,
                schoolGrade: input.schoolGrade,
                schoolName: input.schoolName,
                notes: input.notes,
                householdId: input.householdId,
            },
        }).then(async (result) => {
            if (result.count === 0) {
                return null;
            }
            return this.findById(organizationId, id);
        });
    }

    archive(organizationId: string, id: string): Promise<Member | null> {
        return this.prisma.member.updateMany({
            where: { id, organizationId, status: 'ACTIVE' },
            data: {
                status: 'ARCHIVED',
                archivedAt: new Date(),
            },
        }).then(async (result) => {
            if (result.count === 0) {
                return null;
            }
            return this.findById(organizationId, id);
        });
    }
}