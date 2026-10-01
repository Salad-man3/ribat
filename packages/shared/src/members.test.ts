import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CreateMemberSchema,
  ListMembersQuerySchema,
  UpdateMemberSchema,
} from './members.js';
import { formatValidationError } from './validation.js';

const validMember = {
  firstName: 'Ahmad',
  fatherName: 'Hassan',
  familyName: 'Ali',
  birthDate: '2015-03-01',
  joinedAt: '2024-09-01',
};

test('CreateMemberSchema accepts a valid payload', () => {
  assert.deepEqual(CreateMemberSchema.parse(validMember), validMember);
});

test('CreateMemberSchema rejects missing required fields', () => {
  const result = CreateMemberSchema.safeParse({ firstName: 'Ahmad' });
  assert.equal(result.success, false);
  if (!result.success) {
    const body = formatValidationError(result.error);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.ok(body.error.details?.fatherName);
    assert.ok(body.error.details?.familyName);
    assert.ok(body.error.details?.birthDate);
    assert.ok(body.error.details?.joinedAt);
  }
});

test('CreateMemberSchema rejects invalid date format', () => {
  const result = CreateMemberSchema.safeParse({
    ...validMember,
    birthDate: '03/01/2015',
  });
  assert.equal(result.success, false);
});

test('CreateMemberSchema rejects invalid phone format', () => {
  const result = CreateMemberSchema.safeParse({
    ...validMember,
    phone: '0933123456',
  });
  assert.equal(result.success, false);
});

test('UpdateMemberSchema rejects empty patch', () => {
  const result = UpdateMemberSchema.safeParse({});
  assert.equal(result.success, false);
});

test('ListMembersQuerySchema applies defaults', () => {
  assert.deepEqual(ListMembersQuerySchema.parse({}), {
    limit: 50,
    status: 'ACTIVE',
  });
});

test('ListMembersQuerySchema rejects limit above 200', () => {
  const result = ListMembersQuerySchema.safeParse({ limit: 500 });
  assert.equal(result.success, false);
});
