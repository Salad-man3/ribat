import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import { formatValidationError } from '@ribat/shared';
import type { ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(formatValidationError(result.error));
    }
    return result.data;
  }
}

export function createZodValidationPipe(schema: ZodSchema): ZodValidationPipe {
  return new ZodValidationPipe(schema);
}
