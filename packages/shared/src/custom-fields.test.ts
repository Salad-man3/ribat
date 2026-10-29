import assert from 'node:assert/strict';
import test from 'node:test';
import {
  customFieldKeyFromLabel,
  sanitizeCustomValues,
  type CustomFieldDefinitionResponse,
} from './custom-fields.js';

const defs: Pick<CustomFieldDefinitionResponse, 'key' | 'type'>[] = [
  { key: 'shirt_size', type: 'TEXT' },
  { key: 'score', type: 'NUMBER' },
];

test('sanitizeCustomValues drops unknown keys', () => {
  assert.deepEqual(
    sanitizeCustomValues(defs, { shirt_size: 'L', secret: 'x' }),
    { shirt_size: 'L' },
  );
});

test('sanitizeCustomValues rejects invalid number', () => {
  assert.deepEqual(sanitizeCustomValues(defs, { score: 'not-a-number' }), {});
});

test('customFieldKeyFromLabel slugifies label', () => {
  assert.equal(customFieldKeyFromLabel('  مقاس القميص  '), 'مقاس_القميص');
});
