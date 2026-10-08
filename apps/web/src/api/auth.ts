import type { LoginInput, LoginResponse, MeResponse, RedeemSetupCodeInput } from '@ribat/shared';
import { apiFetch } from './api-fetch';

export function fetchMe() {
  return apiFetch<MeResponse>('/api/v1/auth/me');
}

export function login(input: LoginInput) {
  return apiFetch<LoginResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function redeemSetup(input: RedeemSetupCodeInput) {
  return apiFetch<LoginResponse>('/api/v1/auth/setup', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function logout() {
  return apiFetch<void>('/api/v1/auth/logout', { method: 'POST' });
}

export function switchView(activeView: 'ADMIN' | 'MEMBER') {
  return apiFetch<LoginResponse>('/api/v1/auth/switch-view', {
    method: 'POST',
    body: JSON.stringify({ activeView }),
  });
}
