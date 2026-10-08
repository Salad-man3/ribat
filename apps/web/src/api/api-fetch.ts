import type { ApiErrorBody } from '@ribat/shared';

const CSRF_COOKIE = 'ribat_csrf';
const CSRF_HEADER = 'x-csrf-token';

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

export class ApiError extends Error {
  readonly body: ApiErrorBody;

  constructor(body: ApiErrorBody) {
    super(body.error.message);
    this.body = body;
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  const csrf = readCookie(CSRF_COOKIE);
  if (csrf) headers.set(CSRF_HEADER, csrf);

  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers,
  });

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      (payload as ApiErrorBody) ?? {
        error: { code: 'INTERNAL_ERROR', message: 'Request failed' },
      },
    );
  }
  return payload as T;
}
