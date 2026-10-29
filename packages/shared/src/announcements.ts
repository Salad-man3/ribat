import { z } from 'zod';
import { isoDateTime, uuid } from './fields.js';
import { MembershipRoleSchema } from './people.js';

export const AnnouncementTargetTypeSchema = z.enum([
  'EVERYONE',
  'COURSES',
  'GROUPS',
  'MEMBERS',
  'TAGS',
  'PROGRAMS',
  'ROLES',
]);
export type AnnouncementTargetType = z.infer<typeof AnnouncementTargetTypeSchema>;

export const CreateAnnouncementSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(4000),
    targetType: AnnouncementTargetTypeSchema,
    targetIds: z.array(z.string()).max(200).default([]),
  })
  .superRefine((value, ctx) => {
    if (value.targetType === 'EVERYONE') {
      if (value.targetIds.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Everyone does not take target ids',
          path: ['targetIds'],
        });
      }
      return;
    }
    if (value.targetIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Pick at least one target',
        path: ['targetIds'],
      });
      return;
    }
    if (value.targetType === 'ROLES') {
      for (let i = 0; i < value.targetIds.length; i += 1) {
        const parsed = MembershipRoleSchema.safeParse(value.targetIds[i]);
        if (!parsed.success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Invalid membership role',
            path: ['targetIds', i],
          });
        }
      }
      return;
    }
    for (let i = 0; i < value.targetIds.length; i += 1) {
      const parsed = uuid.safeParse(value.targetIds[i]);
      if (!parsed.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid id',
          path: ['targetIds', i],
        });
      }
    }
  });
export type CreateAnnouncementInput = z.infer<typeof CreateAnnouncementSchema>;

export const AnnouncementResponseSchema = z.object({
  id: uuid,
  title: z.string(),
  body: z.string(),
  targetType: AnnouncementTargetTypeSchema,
  targetIds: z.array(z.string()),
  senderMemberId: uuid,
  createdAt: isoDateTime,
  recipientCount: z.number().int(),
});
export type AnnouncementResponse = z.infer<typeof AnnouncementResponseSchema>;
