import { Module } from '@nestjs/common';
import type { Request, Response } from 'express';
import { LoggerModule, type Params } from 'nestjs-pino';
import type { DestinationStream } from 'pino';
import { ConfigModule, ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { resolveRequestId } from './request-id';

type RequestContext = Request & {
    organizationId?: string;
    membershipId?: string;
};

const capturedLogs: string[] = [];

const testStream: DestinationStream = {
    write(chunk: string) {
        capturedLogs.push(chunk);
    },
};

export function drainCapturedLogs(): unknown[] {
    const raw = capturedLogs.splice(0).join('');
    return raw
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as unknown);
}

function loggingParams(env: Env): Params<Request, Response> {
    const options: NonNullable<Params<Request, Response>['pinoHttp']> = {
        level: env.LOG_LEVEL,
        redact: {
            paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.headers["x-csrf-token"]',
                'res.headers["set-cookie"]',
            ],
            censor: '[redacted]',
        },
        genReqId(req, res) {
            const requestId = resolveRequestId(req.headers['x-request-id']);
            res.setHeader('x-request-id', requestId);
            return requestId;
        },
        customProps(req: RequestContext) {
            return {
                requestId: req.id,
                ...(typeof req.organizationId === 'string' ? { organizationId: req.organizationId } : {}),
                ...(typeof req.membershipId === 'string' ? { membershipId: req.membershipId } : {}),
            };
        },
        customLogLevel(_req, res, err) {
            if (err || res.statusCode >= 500) {
                return 'error';
            }
            if (res.statusCode >= 400) {
                return 'warn';
            }
            return 'info';
        },
        serializers: {
            req(req) {
                const url = typeof req.url === 'string' ? req.url : '';
                return {
                    id: req.id,
                    method: req.method,
                    path: url.split('?')[0],
                };
            },
            res(res) {
                return { statusCode: res.statusCode };
            },
        },
    };

    if (env.NODE_ENV === 'test') {
        return { pinoHttp: [options, testStream] };
    }

    return { pinoHttp: options };
}

@Module({
    imports: [
        LoggerModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ENV],
            useFactory: (env: Env) => loggingParams(env),
        }),
    ],
})
export class LoggingModule { }