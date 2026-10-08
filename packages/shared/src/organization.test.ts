import assert from 'node:assert/strict';
import test from 'node:test';
import { SetupOrganizationSchema, UpdateOrganizationSchema } from './organization.js';

const setup = {
    name: 'Demo Mosque',
    timezone: 'Asia/Damascus',
    latitude: 33.5138,
    longitude: 36.2765,
    prayerMethod: 'UmmAlQura' as const,
    locale: 'ar' as const,
    sheikh: {
        firstName: 'Ahmad',
        fatherName: 'Hassan',
        familyName: 'Ali',
        phone: '+963944000111',
    },
};

test('SetupOrganizationSchema accepts the self-host form', () => {
    assert.deepEqual(SetupOrganizationSchema.parse(setup), setup);
});

test('SetupOrganizationSchema rejects a latitude outside the range', () => {
    const result = SetupOrganizationSchema.safeParse({ ...setup, latitude: 120 });
    assert.equal(result.success, false);
});

test('SetupOrganizationSchema rejects a city name as a time zone', () => {
    const result = SetupOrganizationSchema.safeParse({ ...setup, timezone: 'Damascus' });
    assert.equal(result.success, false);
});

test('UpdateOrganizationSchema rejects an empty patch', () => {
    assert.equal(UpdateOrganizationSchema.safeParse({}).success, false);
});