import { useQuery } from '@tanstack/react-query';
import type { CourseResponse, MaterialResponse } from '@ribat/shared';
import { apiFetch } from './api-fetch';

export const courseKey = (id: string, ...rest: string[]) => [
  'course',
  id,
  ...rest,
];

export function useCourse(id: string) {
  return useQuery({
    queryKey: courseKey(id),
    queryFn: () => apiFetch<CourseResponse>(`/api/v1/courses/${id}`),
    retry: false,
  });
}

export function useMaterials() {
  return useQuery({
    queryKey: ['materials'],
    queryFn: () => apiFetch<MaterialResponse[]>('/api/v1/materials'),
  });
}
