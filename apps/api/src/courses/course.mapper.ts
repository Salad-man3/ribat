import type { Course, Member } from '@prisma/client';
import type { CourseResponse } from '@ribat/shared';
import { storedCustomValues } from '../custom-fields/stored-custom-values';
import { toDateString } from '../common/zoned-time';

export function toCourseResponse(row: Course): CourseResponse {
  return {
    id: row.id,
    organizationId: row.organizationId,
    programId: row.programId,
    name: row.name,
    description: row.description,
    type: row.type,
    status: row.status,
    startDate: row.startDate ? toDateString(row.startDate) : null,
    endDate: row.endDate ? toDateString(row.endDate) : null,
    location: row.location,
    minAge: row.minAge,
    maxAge: row.maxAge,
    capacity: row.capacity,
    isHierarchical: row.isHierarchical,
    hasGroups: row.hasGroups,
    testPassMark: row.testPassMark,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    customValues: storedCustomValues(row.customValues),
  };
}

export function memberName(
  member: Pick<Member, 'firstName' | 'fatherName' | 'familyName'>,
): string {
  return `${member.firstName} ${member.fatherName} ${member.familyName}`;
}
