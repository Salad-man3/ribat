import { resolveAuditNames, type AuditNameMaps } from './audit-present';

const maps: AuditNameMaps = {
  actors: new Map([['m-sh', 'الشيخ أحمد']]),
  members: new Map([
    ['mem-t', 'محمود علي'],
    ['mem-s', 'سامي حسن'],
  ]),
  courses: new Map([['c1', 'حلقة الفجر']]),
  programs: new Map([['p1', 'دورة رمضان']]),
  materials: new Map(),
};

describe('resolveAuditNames', () => {
  it('splits teacher assignment into person and halaqa', () => {
    expect(
      resolveAuditNames(
        {
          action: 'teacher.assigned',
          entityType: 'course',
          entityId: 'c1',
          actorMembershipId: 'm-sh',
          before: null,
          after: { teacherMemberId: 'mem-t', role: 'LEAD' },
        },
        maps,
      ),
    ).toEqual({
      targetName: 'محمود علي',
      contextName: 'حلقة الفجر',
    });
  });

  it('resolves course creation from payload name', () => {
    expect(
      resolveAuditNames(
        {
          action: 'course.created',
          entityType: 'course',
          entityId: 'c1',
          actorMembershipId: null,
          before: null,
          after: { name: 'حلقة العصر' },
        },
        maps,
      ),
    ).toEqual({ targetName: 'حلقة العصر', contextName: null });
  });
});
