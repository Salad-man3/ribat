import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ApiErrorBody, ApiErrorCode } from '@ribat/shared';
import type { Request, Response } from 'express';

type RequestWithId = Request & { id?: string; requestId?: string };

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();
    const requestId = request.id ?? request.requestId;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = this.toApiErrorBody(exception, status, requestId);
      response.status(status).json(body);
      return;
    }

    this.logger.error('Unhandled exception', exception instanceof Error ? exception.stack : exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
      requestId,
    } satisfies ApiErrorBody);
  }

  private toApiErrorBody(
    exception: HttpException,
    status: number,
    requestId?: string,
  ): ApiErrorBody {
    const response = exception.getResponse();

    const body = exception.getResponse();
    const error =
      typeof body === 'object' && body !== null && 'error' in body
        ? (body as { error: unknown }).error
        : undefined;

    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as { code: unknown }).code === 'string'
    ) {
      return {
        ...(body as ApiErrorBody),
        requestId,
      };
    }
    return {
      error: {
        code: this.codeForStatus(status),
        message: typeof response === 'string' ? response : exception.message,
        details:
          typeof response === 'object' && response !== null && 'message' in response
            ? { message: [(response as { message: string | string[] }).message].flat() }
            : undefined,
      },
      requestId,
    };
  }

  private codeForStatus(status: number): ApiErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'VALIDATION_ERROR';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMITED';
      default:
        return 'INTERNAL_ERROR';
    }
  }
}