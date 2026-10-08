import { hashSessionToken, newSessionToken, readSessionCookie } from './session-cookie';

describe('session cookie', () => {
    it('stores a hash that is not the cookie and depends on the secret', () => {
        const token = newSessionToken();
        const hash = hashSessionToken(token, 'secret');
        expect(hash).not.toBe(token);
        expect(hashSessionToken(token, 'secret')).toBe(hash);
        expect(hashSessionToken(token, 'other')).not.toBe(hash);
    });

    it('reads only the session cookie', () => {
        expect(readSessionCookie('a=1; ribat_session=abc; b=2')).toBe('abc');
        expect(readSessionCookie(undefined)).toBeUndefined();
    });
});