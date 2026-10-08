import assert from 'node:assert/strict';
import test from 'node:test';
import {
    CreateGuardianLinkSchema,
    CreateMemberNoteSchema,
    UpdateMembershipSchema,
} from './people.js';

test('CreateGuardianLinkSchema defaults isPrimary for an existing guardian', () => {
    const parsed = CreateGuardianLinkSchema.parse({
        mode: 'existing',
        guardianMemberId: '5b6b9c3e-6e4d-4f3a-9c1e-1a2b3c4d5e6f',
        relation: 'FATHER',
    });
    assert.equal(parsed.mode, 'existing');
    if (parsed.mode === 'existing') {
        assert.equal(parsed.isPrimary, false);
    }
});

test('CreateGuardianLinkSchema rejects a missing mode', () => {
    const result = CreateGuardianLinkSchema.safeParse({
        guardianMemberId: '5b6b9c3e-6e4d-4f3a-9c1e-1a2b3c4d5e6f',
        relation: 'MOTHER',
    });
    assert.equal(result.success, false);
});

test('CreateMemberNoteSchema defaults visibility to sheikh only', () => {
    const parsed = CreateMemberNoteSchema.parse({ body: 'Needs review' });
    assert.equal(parsed.visibility, 'SHEIKH_ONLY');
});

test('UpdateMembershipSchema requires a role or a status besides the password', () => {
    const result = UpdateMembershipSchema.safeParse({ currentPassword: 'secret' });
    assert.equal(result.success, false);
});