import assert from 'node:assert/strict';
import test from 'node:test';
import { notificationCategory } from './notifications.js';

test('notificationCategory maps types to inbox categories', () => {
  assert.equal(notificationCategory('HOMEWORK_ASSIGNED'), 'homework');
  assert.equal(notificationCategory('ANNOUNCEMENT'), 'announcements');
  assert.equal(notificationCategory('EXCUSE_DECIDED'), 'attendance');
});
