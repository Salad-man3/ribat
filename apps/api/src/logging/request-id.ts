import { randomUUID } from 'node:crypto';

const UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function resolveRequestId(header: string | string[] | undefined): string {
    const value = Array.isArray(header) ? header[0] : header;
    return value !== undefined && UUID.test(value) ? value : randomUUID();
}