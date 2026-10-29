import type { AuditLog } from '@prisma/client';
import { memberName } from '../courses/course.mapper';

type Row = Pick<
  AuditLog,
  | 'action'
  | 'entityType'
  | 'entityId'
  | 'before'
  | 'after'
  | 'actorMembershipId'
>;

type Json = Record<string, unknown>;

export type AuditNameMaps = {
  actors: Map<string, string>;
  members: Map<string, string>;
  courses: Map<string, string>;
  programs: Map<string, string>;
  materials: Map<string, string>;
};

function asObject(value: unknown): Json | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Json;
  }
  return null;
}

function pickName(...objects: (Json | null)[]): string | null {
  for (const o of objects) {
    if (!o) continue;
    if (typeof o.name === 'string' && o.name.trim()) return o.name.trim();
    if (typeof o.title === 'string' && o.title.trim()) return o.title.trim();
  }
  return null;
}

export function collectAuditLookups(rows: Row[]) {
  const membershipIds = new Set<string>();
  const memberIds = new Set<string>();
  const courseIds = new Set<string>();
  const programIds = new Set<string>();
  const enrollmentIds = new Set<string>();
  const materialIds = new Set<string>();

  const member = (id: unknown) => {
    if (typeof id === 'string') memberIds.add(id);
  };

  for (const row of rows) {
    if (row.actorMembershipId) membershipIds.add(row.actorMembershipId);
    const after = asObject(row.after);
    const before = asObject(row.before);
    member(after?.memberId);
    member(before?.memberId);
    member(after?.teacherMemberId);
    member(before?.teacherMemberId);

    if (row.entityType === 'member') memberIds.add(row.entityId);
    if (row.entityType === 'course') courseIds.add(row.entityId);
    if (row.entityType === 'program') programIds.add(row.entityId);
    if (row.entityType === 'enrollment') enrollmentIds.add(row.entityId);
    if (row.entityType === 'material') materialIds.add(row.entityId);
    if (typeof after?.courseId === 'string') courseIds.add(after.courseId);
    if (typeof before?.courseId === 'string') courseIds.add(before.courseId);
  }

  return {
    membershipIds: [...membershipIds],
    memberIds: [...memberIds],
    courseIds: [...courseIds],
    programIds: [...programIds],
    enrollmentIds: [...enrollmentIds],
    materialIds: [...materialIds],
  };
}

export function resolveAuditNames(
  row: Row,
  maps: AuditNameMaps,
): { targetName: string | null; contextName: string | null } {
  const after = asObject(row.after);
  const before = asObject(row.before);
  const fromPayload = pickName(after, before);

  const member = (id: string | undefined) =>
    id ? (maps.members.get(id) ?? null) : null;
  const course = (id: string | undefined) =>
    id ? (maps.courses.get(id) ?? null) : null;

  switch (row.action) {
    case 'course.created':
    case 'course.updated':
    case 'course.status_changed':
      return {
        targetName: fromPayload ?? course(row.entityId),
        contextName: null,
      };
    case 'program.created':
    case 'program.updated':
    case 'program.archived':
      return {
        targetName: fromPayload ?? maps.programs.get(row.entityId) ?? null,
        contextName: null,
      };
    case 'teacher.assigned':
      return {
        targetName: member(
          typeof after?.teacherMemberId === 'string'
            ? after.teacherMemberId
            : undefined,
        ),
        contextName: course(row.entityId),
      };
    case 'teacher.removed':
      return {
        targetName: member(
          typeof before?.teacherMemberId === 'string'
            ? before.teacherMemberId
            : undefined,
        ),
        contextName: course(row.entityId),
      };
    case 'enrollment.created':
      return {
        targetName: member(
          typeof after?.memberId === 'string' ? after.memberId : undefined,
        ),
        contextName: course(
          typeof after?.courseId === 'string' ? after.courseId : undefined,
        ),
      };
    case 'enrollment.withdrawn':
      return {
        targetName: member(
          typeof before?.memberId === 'string' ? before.memberId : undefined,
        ),
        contextName: course(
          typeof before?.courseId === 'string' ? before.courseId : undefined,
        ),
      };
    case 'member.created':
    case 'member.updated':
    case 'member.archived':
      return {
        targetName: maps.members.get(row.entityId) ?? null,
        contextName: null,
      };
    case 'material.created':
    case 'material.updated':
    case 'material.archived':
      return {
        targetName: fromPayload ?? maps.materials.get(row.entityId) ?? null,
        contextName: null,
      };
    case 'group.created':
    case 'group.updated':
    case 'group.deleted':
    case 'group_member.added':
    case 'group_member.removed':
      return {
        targetName: fromPayload,
        contextName: course(
          typeof after?.courseId === 'string' ? after.courseId : undefined,
        ),
      };
    default: {
      const memberId =
        typeof after?.memberId === 'string'
          ? after.memberId
          : typeof before?.memberId === 'string'
            ? before.memberId
            : undefined;
      const courseId =
        typeof after?.courseId === 'string'
          ? after.courseId
          : typeof before?.courseId === 'string'
            ? before.courseId
            : undefined;
      if (row.entityType === 'course') {
        return { targetName: course(row.entityId), contextName: null };
      }
      if (row.entityType === 'member') {
        return {
          targetName: maps.members.get(row.entityId) ?? null,
          contextName: null,
        };
      }
      if (memberId) {
        return { targetName: member(memberId), contextName: course(courseId) };
      }
      if (courseId) {
        return { targetName: course(courseId), contextName: null };
      }
      return { targetName: fromPayload, contextName: null };
    }
  }
}

export function memberLabel(
  member: Pick<
    import('@prisma/client').Member,
    'firstName' | 'fatherName' | 'familyName'
  >,
): string {
  return memberName(member);
}
