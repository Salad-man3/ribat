import { useQuery } from '@tanstack/react-query';
import type { MemberResponse } from '@ribat/shared';
import { apiFetch } from './api-fetch';

// ponytail: one page of 200 is the whole pilot mosque; page through with `cursor` past that.
export function useMembers(
  status: 'ACTIVE' | 'ARCHIVED' = 'ACTIVE',
  search = '',
) {
  const params = new URLSearchParams({ status, limit: '200' });
  if (search.trim()) params.set('search', search.trim());
  return useQuery({
    queryKey: ['members', status, search.trim()],
    queryFn: () => apiFetch<MemberResponse[]>(`/api/v1/members?${params}`),
  });
}
