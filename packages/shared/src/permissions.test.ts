import assert from 'node:assert/strict';
import test from 'node:test';
import { canUseAdminView, permissionsFor } from './permissions.js';

test('ORG_ADMIN defaults to full staff keys', () => {
  assert.ok(permissionsFor('ORG_ADMIN', 'ADMIN').includes('courses.manage'));
});

test('tag union applies to members in admin view', () => {
  assert.deepEqual(
    permissionsFor('MEMBER', 'ADMIN', {
      tagsEnabled: true,
      tagPermissionKeys: ['materials.manage'],
    }),
    ['materials.manage'],
  );
});

test('canUseAdminView is false for member without grants', () => {
  assert.equal(canUseAdminView('MEMBER', {}), false);
});

test('canUseAdminView is true for member with tag grant', () => {
  assert.equal(
    canUseAdminView('MEMBER', {
      tagsEnabled: true,
      tagPermissionKeys: ['members.manage'],
    }),
    true,
  );
});
