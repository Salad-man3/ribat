import { resolveRequestId } from './request-id';

const KNOWN_ID = '11111111-1111-4111-8111-111111111111';
const UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('resolveRequestId', () => {
    it('keeps a valid UUID', () => {
        expect(resolveRequestId(KNOWN_ID)).toBe(KNOWN_ID);
    });

    it('keeps a valid UUID when it is the first header value', () => {
        expect(resolveRequestId([KNOWN_ID, 'ignored'])).toBe(KNOWN_ID);
    });

    it('generates a UUID when the header is missing', () => {
        const first = resolveRequestId(undefined);
        const second = resolveRequestId(undefined);

        expect(first).toMatch(UUID);
        expect(second).toMatch(UUID);
        expect(first).not.toBe(second);
    });

    it('generates a UUID when the header is not a UUID', () => {
        const generated = resolveRequestId('not-a-uuid\ninjected');

        expect(generated).toMatch(UUID);
        expect(generated).not.toContain('not-a-uuid');
    });

    it('generates a UUID when the first repeated header is not a UUID', () => {
        const generated = resolveRequestId(['not-a-uuid', KNOWN_ID]);

        expect(generated).toMatch(UUID);
        expect(generated).not.toBe(KNOWN_ID);
    });
});