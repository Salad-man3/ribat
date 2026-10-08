import { z } from 'zod';

/** E.164, the same rule Identity.phone uses. */
export const e164Phone = z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{1,14}$/, 'Must be E.164 format');

export const requiredName = z.string().trim().min(1, 'Required');

/** Calendar date. Zod checks that the day exists, so 2015-02-31 fails. */
export const isoDate = z.string().date();

/** `toISOString()` form, for example 2026-10-08T12:00:00.000Z. */
export const isoDateTime = z.string().datetime();

export const uuid = z.string().uuid();

export const latitude = z.number().gte(-90).lte(90);
export const longitude = z.number().gte(-180).lte(180);

export const ianaTimeZone = z.string().refine(
    (value) => {
        try {
            Intl.DateTimeFormat(undefined, { timeZone: value });
            return true;
        } catch {
            return false;
        }
    },
    { message: 'Must be an IANA time zone' },
);

/** Chosen by the person during setup. Staff never send this. */
export const newPassword = z.string().min(8).max(128);

/** Proves the caller knows the current password. Strength is not re-checked. */
export const currentPassword = z.string().min(1).max(128);

/**
 * Shown once, stored hashed. Lowercase input is accepted and normalized.
 * T105 must generate this alphabet.
 */
export const setupCode = z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/, 'Invalid setup code');

export const deviceLabel = z.string().trim().min(1).max(80);