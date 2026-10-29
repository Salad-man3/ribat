import { z } from 'zod';
import { CustomValuesInputSchema, CustomValuesSchema } from './custom-fields.js';
import { isoDate, isoDateTime, requiredName, uuid } from './fields.js';

const programFields = z.object({
  name: requiredName,
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  customValues: CustomValuesInputSchema,
});

const datesInOrder = (value: {
  startDate?: string | null;
  endDate?: string | null;
}) =>
  !value.startDate ||
  !value.endDate ||
  value.startDate <= value.endDate;

export const CreateProgramSchema = programFields.refine(datesInOrder, {
  message: 'endDate must not be before startDate',
  path: ['endDate'],
});
export type CreateProgramInput = z.infer<typeof CreateProgramSchema>;

export const UpdateProgramSchema = z
  .object({
    name: requiredName.optional(),
    startDate: isoDate.nullable().optional(),
    endDate: isoDate.nullable().optional(),
    customValues: CustomValuesInputSchema,
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  })
  .refine(datesInOrder, {
    message: 'endDate must not be before startDate',
    path: ['endDate'],
  });
export type UpdateProgramInput = z.infer<typeof UpdateProgramSchema>;

export const ProgramResponseSchema = z.object({
  id: uuid,
  organizationId: uuid,
  name: z.string(),
  startDate: isoDate.nullable(),
  endDate: isoDate.nullable(),
  createdAt: isoDateTime,
  archivedAt: isoDateTime.nullable(),
  customValues: CustomValuesSchema,
});
export type ProgramResponse = z.infer<typeof ProgramResponseSchema>;
