import { describe, expect, it } from 'vitest';
import { ApiError } from './api-fetch';

describe('ApiError', () => {
  it('keeps the API error body', () => {
    const error = new ApiError({ error: { code: 'FORBIDDEN', message: 'Forbidden' } });
    expect(error.body.error.code).toBe('FORBIDDEN');
  });
});
