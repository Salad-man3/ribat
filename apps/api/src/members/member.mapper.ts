import type { Member } from '@prisma/client';
import type { MemberResponse } from '@ribat/shared';

function toDateString(value: Date): string {
    return value.toISOString().slice(0, 10);
}

function toIsoString(value: Date): string {
    return value.toISOString();
}

export function toMemberResponse(member: Member): MemberResponse {
    return {
        id: member.id,
        organizationId: member.organizationId,
        householdId: member.householdId,
        firstName: member.firstName,
        fatherName: member.fatherName,
        familyName: member.familyName,
        motherName: member.motherName,
        birthDate: toDateString(member.birthDate),
        phone: member.phone,
        address: member.address,
        schoolGrade: member.schoolGrade,
        schoolName: member.schoolName,
        joinedAt: toDateString(member.joinedAt),
        notes: member.notes,
        status: member.status,
        createdAt: toIsoString(member.createdAt),
        updatedAt: toIsoString(member.updatedAt),
        archivedAt: member.archivedAt ? toIsoString(member.archivedAt) : null,
    };
}