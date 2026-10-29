import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CreateGuardianJoinApplicationSchema,
  CreateStudentJoinApplicationSchema,
} from './join-applications.js';

describe('join applications', () => {
  it('accepts student apply payload', () => {
    const parsed = CreateStudentJoinApplicationSchema.safeParse({
      kind: 'STUDENT',
      phone: '+963999123456',
      firstName: 'A',
      fatherName: 'B',
      familyName: 'C',
      birthDate: '2010-05-01',
    });
    assert.equal(parsed.success, true);
  });

  it('accepts guardian apply payload with wards', () => {
    const parsed = CreateGuardianJoinApplicationSchema.safeParse({
      kind: 'GUARDIAN',
      phone: '+963999123456',
      firstName: 'G',
      fatherName: 'H',
      familyName: 'I',
      wards: [
        {
          firstName: 'W',
          fatherName: 'G',
          familyName: 'I',
          birthDate: '2015-01-01',
          relation: 'FATHER',
        },
      ],
    });
    assert.equal(parsed.success, true);
  });
});
