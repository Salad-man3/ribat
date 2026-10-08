import assert from 'node:assert/strict';
import test from 'node:test';
import { LoginSchema, RedeemSetupCodeSchema, RevokeDeviceQuerySchema, SwitchViewSchema } from './auth.js';

const phone = '+963944000111';

test('LoginSchema rejects a local phone number', () => {
    const result = LoginSchema.safeParse({ phone: '0944000111', password: 'secret' });
    assert.equal(result.success, false);
});

test('RedeemSetupCodeSchema uppercases the code and rejects a short password', () => {
    const result = RedeemSetupCodeSchema.safeParse({
        phone,
        code: 'ab23def4',
        password: 'short',
    });
    assert.equal(result.success, false);

    const accepted = RedeemSetupCodeSchema.parse({
        phone,
        code: 'ab23def4',
        password: 'longenough',
    });
    assert.equal(accepted.code, 'AB23DEF4');
});

test('RedeemSetupCodeSchema rejects ambiguous characters', () => {
    const result = RedeemSetupCodeSchema.safeParse({
        phone,
        code: 'AI234567',
        password: 'longenough',
    });
    assert.equal(result.success, false);
});

test('SwitchViewSchema allows only the two staff views', () => {
    assert.equal(SwitchViewSchema.parse({ activeView: 'ADMIN' }).activeView, 'ADMIN');
    assert.equal(SwitchViewSchema.safeParse({ activeView: 'TEACHER' }).success, false);
});

test('RevokeDeviceQuerySchema treats the string false as omitted', () => {
    assert.deepEqual(RevokeDeviceQuerySchema.parse({}), {});
    assert.deepEqual(RevokeDeviceQuerySchema.parse({ all: 'true' }), { all: 'true' });
    assert.equal(RevokeDeviceQuerySchema.safeParse({ all: 'false' }).success, false);
});