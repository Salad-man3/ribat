import assert from 'node:assert/strict';
import test from 'node:test';
import { CreateProgramSchema, UpdateProgramSchema } from './programs.js';

test('CreateProgramSchema rejects endDate before startDate', () => {
  const result = CreateProgramSchema.safeParse({
    name: 'Ramadan',
    startDate: '2026-04-01',
    endDate: '2026-03-01',
  });
  assert.equal(result.success, false);
});

test('UpdateProgramSchema rejects endDate before startDate', () => {
  const result = UpdateProgramSchema.safeParse({
    startDate: '2026-04-01',
    endDate: '2026-03-01',
  });
  assert.equal(result.success, false);
});
