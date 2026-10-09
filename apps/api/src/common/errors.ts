import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

/** DM-02: a row from another organization is reported the same way as a missing one. */
export function notFound(what: string): NotFoundException {
  return new NotFoundException({
    error: { code: 'NOT_FOUND', message: `${what} not found` },
  });
}

export function conflict(message: string): ConflictException {
  return new ConflictException({ error: { code: 'CONFLICT', message } });
}

export function forbidden(message = 'Forbidden'): ForbiddenException {
  return new ForbiddenException({ error: { code: 'FORBIDDEN', message } });
}

export function unavailable(message: string): ServiceUnavailableException {
  return new ServiceUnavailableException({
    error: { code: 'UNAVAILABLE', message },
  });
}

/** Prisma's unique-constraint violation. */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

export function badRequest(
  field: string,
  message: string,
): BadRequestException {
  return new BadRequestException({
    error: {
      code: 'VALIDATION_ERROR',
      message,
      details: { [field]: [message] },
    },
  });
}
