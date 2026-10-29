import { permissionsForMembershipContext } from './membership-permissions';

describe('permissionsForMembershipContext', () => {
  it('ORG_ADMIN with reduced orgAdminPermissions omits keys not listed', () => {
    expect(
      permissionsForMembershipContext({
        role: 'ORG_ADMIN',
        activeView: 'ADMIN',
        organizationSettings: { orgAdminPermissions: ['members.manage'] },
        tagPermissionsJson: [],
      }),
    ).toEqual(['members.manage']);
  });

  it('SHEIKH keeps full staff keys', () => {
    expect(
      permissionsForMembershipContext({
        role: 'SHEIKH',
        activeView: 'ADMIN',
        organizationSettings: {},
        tagPermissionsJson: [],
      }).includes('memberships.manage_org_admin'),
    ).toBe(true);
  });

  it('unions tag permissions for org admin when tags enabled', () => {
    expect(
      permissionsForMembershipContext({
        role: 'ORG_ADMIN',
        activeView: 'ADMIN',
        organizationSettings: {
          tagsEnabled: true,
          orgAdminPermissions: ['members.manage'],
        },
        tagPermissionsJson: [['audit.read']],
      }).sort(),
    ).toEqual(['audit.read', 'members.manage'].sort());
  });
});
