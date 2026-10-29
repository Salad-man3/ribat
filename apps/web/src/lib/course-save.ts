import type { CourseFormValues } from '../components/CourseForm';
import { apiFetch } from '../api/api-fetch';

export async function saveCourseExtras(courseId: string, values: CourseFormValues) {
  if (values.teacherMemberId) {
    await apiFetch(`/api/v1/courses/${courseId}/teachers`, {
      method: 'POST',
      body: JSON.stringify({ memberId: values.teacherMemberId }),
    });
  }
  if (values.rules.length) {
    await apiFetch(`/api/v1/courses/${courseId}/schedule`, {
      method: 'PUT',
      body: JSON.stringify({ rules: values.rules }),
    });
  }
}
