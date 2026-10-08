import { setupCode } from '@ribat/shared';
import { generateSetupCode, hashSecret, verifySecret } from './credentials';

describe('credentials', () => {
    it('generates a code the shared schema accepts', () => {
        for (let i = 0; i < 20; i += 1) {
            expect(setupCode.safeParse(generateSetupCode()).success).toBe(true);
        }
    });

    it('verifies the password that was hashed and rejects a different one', async () => {
        const hash = await hashSecret('longenough');
        expect(hash).not.toContain('longenough');
        expect(await verifySecret(hash, 'longenough')).toBe(true);
        expect(await verifySecret(hash, 'other-password')).toBe(false);
    });
});