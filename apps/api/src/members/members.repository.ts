import type { AuditContext } from '../audit/audit-context';
import { emit } from '../events/emit';
import { Injectable } from '@nestjs/common';
import type { Member, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateMemberInput, ListMembersQuery, UpdateMemberInput } from '@ribat/shared';

@Injectable()
export class MembersRepository {
    constructor(private readonly prisma: PrismaService) { }

    create(organizationId: string, input: CreateMemberInput): Promise<Member> {
        return this.prisma.forOrganization(organizationId).member.create({
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
                studyStatus: input.studyStatus,
                university: input.university,
                faculty: input.faculty,
                universityYear: input.universityYear,
                highestEducation: input.highestEducation,
                notes: input.notes,
                householdId: input.householdId,
            },
        });
    }

    findById(organizationId: string, id: string): Promise<Member | null> {
        return this.prisma.forOrganization(organizationId).member.findFirst({
            where: { id },
        });
    }

    list(organizationId: string, query: ListMembersQuery): Promise<Member[]> {
        const where: Prisma.MemberWhereInput = {
            status: query.status,
        };

        if (query.search) {
            where.OR = [
                { firstName: { contains: query.search, mode: 'insensitive' } },
                { fatherName: { contains: query.search, mode: 'insensitive' } },
                { familyName: { contains: query.search, mode: 'insensitive' } },
            ];
        }

        return this.prisma.forOrganization(organizationId).member.findMany({
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
        return this.prisma.forOrganization(organizationId).member.updateMany({
            where: { id, status: 'ACTIVE' },
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
                studyStatus: input.studyStatus,
                university: input.university,
                faculty: input.faculty,
                universityYear: input.universityYear,
                highestEducation: input.highestEducation,
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

    /** The `member.archived` event commits with the archive; its handler closes enrollments and logins (WF-10). */
    archive(organizationId: string, id: string, ctx: AuditContext): Promise<Member | null> {
        return this.prisma.forOrganization(organizationId).$transaction(async (tx) => {
            const result = await tx.member.updateMany({
                where: { id, status: 'ACTIVE' },
                data: {
                    status: 'ARCHIVED',
                    archivedAt: new Date(),
                },
            });
            if (result.count === 0) {
                return null;
            }
            await emit(tx, ctx, {
                type: 'member.archived',
                aggregateType: 'member',
                aggregateId: id,
                payload: { memberId: id },
            });
            return tx.member.findFirst({ where: { id } });
        });
    }
}