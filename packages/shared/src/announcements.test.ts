import assert from 'node:assert/strict';
import test from 'node:test';
import { CreateAnnouncementSchema } from './announcements.js';

test('CreateAnnouncementSchema requires target ids unless audience is everyone', () => {
  assert.equal(
    CreateAnnouncementSchema.safeParse({
      title: 'Hi',
      body: 'There',
      targetType: 'COURSES',
      targetIds: [],
    }).success,
    false,
  );
  assert.equal(
    CreateAnnouncementSchema.safeParse({
      title: 'Hi',
      body: 'There',
      targetType: 'EVERYONE',
      targetIds: [],
    }).success,
    true,
  );
});

test('CreateAnnouncementSchema accepts membership roles for ROLES audience', () => {
  assert.equal(
    CreateAnnouncementSchema.safeParse({
      title: 'Hi',
      body: 'There',
      targetType: 'ROLES',
      targetIds: ['MEMBER', 'GUARDIAN'],
    }).success,
    true,
  );
  assert.equal(
    CreateAnnouncementSchema.safeParse({
      title: 'Hi',
      body: 'There',
      targetType: 'ROLES',
      targetIds: ['not-a-role'],
    }).success,
    false,
  );
});
