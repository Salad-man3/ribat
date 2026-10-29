import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch } from './api-fetch';

describe('ApiError', () => {
  it('keeps the API error body', () => {
    const error = new ApiError({
      error: { code: 'FORBIDDEN', message: 'Forbidden' },
    });
    expect(error.body.error.code).toBe('FORBIDDEN');
  });
});

describe('apiFetch', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_DEMO_BROWSER', 'false');
    document.cookie = 'ribat_csrf=; Max-Age=0; path=/';
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('sends credentials and CSRF header from the session cookie', async () => {
    document.cookie = 'ribat_csrf=tok-123; path=/';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/v1/ping');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.credentials).toBe('include');
    expect((init?.headers as Headers).get('x-csrf-token')).toBe('tok-123');
  });

  it('returns undefined for 204 responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        json: async () => {
          throw new Error('no body');
        },
      }),
    );

    await expect(apiFetch('/api/v1/resource')).resolves.toBeUndefined();
  });

  it('throws ApiError with the server body on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          error: { code: 'FORBIDDEN', message: 'Nope' },
        }),
      }),
    );

    await expect(apiFetch('/api/v1/resource')).rejects.toMatchObject({
      status: 403,
      body: { error: { code: 'FORBIDDEN', message: 'Nope' } },
    });
  });

  it('routes through @demo/client when VITE_DEMO_BROWSER is true', async () => {
    vi.stubEnv('VITE_DEMO_BROWSER', 'true');
    vi.resetModules();
    const { apiFetch: demoFetch } = await import('./api-fetch');

    await expect(demoFetch('/api/v1/ping')).rejects.toThrow(/Demo client is only available/);
  });
});
