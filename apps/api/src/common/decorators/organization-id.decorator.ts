import {
    createParamDecorator,
    ExecutionContext,
    BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';

export const OrganizationId = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): string => {
        const request = ctx.switchToHttp().getRequest<Request>();
        const organizationId = request.header('x-organization-id');

        if (!organizationId) {
            throw new BadRequestException({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Missing X-Organization-Id header',
                },
            });
        }

        return organizationId;
    },
);
