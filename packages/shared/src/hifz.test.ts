import assert from 'node:assert/strict';
import test from 'node:test';
import { awqafLevelJuzCount, CreateAwqafExamSchema } from './hifz.js';

test('awqafLevelJuzCount', () => {
  assert.equal(awqafLevelJuzCount('AJZA_1'), 1);
  assert.equal(awqafLevelJuzCount('AJZA_5'), 5);
  assert.equal(awqafLevelJuzCount('KHATMAH'), 30);
});

test('CreateAwqafExamSchema requires contiguous range length for level', () => {
  assert.equal(
    CreateAwqafExamSchema.safeParse({
      level: 'AJZA_3',
      juzFrom: 1,
      juzTo: 2,
      passed: true,
    }).success,
    false,
  );
  assert.equal(
    CreateAwqafExamSchema.safeParse({
      level: 'AJZA_1',
      juzFrom: 30,
      juzTo: 30,
      passed: true,
    }).success,
    true,
  );
  assert.equal(
    CreateAwqafExamSchema.safeParse({
      level: 'AJZA_5',
      juzFrom: 26,
      juzTo: 30,
      passed: true,
      score: 88,
    }).success,
    true,
  );
  assert.equal(
    CreateAwqafExamSchema.safeParse({
      level: 'KHATMAH',
      juzFrom: 1,
      juzTo: 30,
      passed: false,
    }).success,
    true,
  );
  assert.equal(
    CreateAwqafExamSchema.safeParse({
      level: 'AJZA_5',
      juzFrom: 10,
      juzTo: 5,
      passed: true,
    }).success,
    false,
  );
});
