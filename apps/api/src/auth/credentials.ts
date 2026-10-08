import { randomInt } from 'node:crypto';
import argon2 from 'argon2';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

const ARGON2_OPTIONS = {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
} as const;

export function generateSetupCode(): string {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i += 1) {
        code += ALPHABET[randomInt(ALPHABET.length)];
    }
    return code;
}

export function hashSecret(plain: string): Promise<string> {
    return argon2.hash(plain, ARGON2_OPTIONS);
}

export function verifySecret(hash: string, plain: string): Promise<boolean> {
    return argon2.verify(hash, plain);
}