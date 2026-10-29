import { z } from 'zod';

export const NotificationCategorySchema = z.enum([
  'attendance',
  'homework',
  'progress',
  'schedule',
  'announcements',
]);
export type NotificationCategory = z.infer<typeof NotificationCategorySchema>;

const CATEGORY_BY_TYPE: Record<string, NotificationCategory> = {
  ABSENCE_SUMMARY: 'attendance',
  ATTENDANCE_OVERRIDDEN: 'attendance',
  EXCUSE_DECIDED: 'attendance',
  HOMEWORK_ASSIGNED: 'homework',
  HOMEWORK_MISSED: 'homework',
  TEST_RESULT: 'progress',
  SCHEDULE_CHANGE: 'schedule',
  SESSION_NOT_TAKEN: 'schedule',
  ANNOUNCEMENT: 'announcements',
};

export function notificationCategory(type: string): NotificationCategory {
  const category = CATEGORY_BY_TYPE[type];
  if (!category) {
    throw new Error(`Unknown notification type: ${type}`);
  }
  return category;
}

export const NOTIFICATION_CATEGORIES = NotificationCategorySchema.options;

export const NotificationCategoryCountsSchema = z.object({
  attendance: z.number().int(),
  homework: z.number().int(),
  progress: z.number().int(),
  schedule: z.number().int(),
  announcements: z.number().int(),
});
export type NotificationCategoryCounts = z.infer<
  typeof NotificationCategoryCountsSchema
>;
