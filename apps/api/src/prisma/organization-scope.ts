import { Prisma } from '@prisma/client';

const TENANT_MODELS = new Set([
    'Membership',
    'Household',
    'Member',
    'GuardianLink',
    'MemberNote',
    'AuditLog',
]);

const UNIQUE_WHERE_OPERATIONS = new Set([
    'findUnique',
    'findUniqueOrThrow',
    'update',
    'delete',
    'upsert',
]);

const WHERE_OPERATIONS = new Set([
    'findFirst',
    'findFirstOrThrow',
    'findMany',
    'count',
    'aggregate',
    'groupBy',
    'updateMany',
    'updateManyAndReturn',
    'deleteMany',
]);

const CREATE_OPERATIONS = new Set(['create']);
const CREATE_MANY_OPERATIONS = new Set(['createMany', 'createManyAndReturn']);

export class TenantScopeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TenantScopeError';
    }
}

type Row = Record<string, unknown>;

type QueryArgs = {
    where?: Row;
    data?: Row | Row[];
    create?: Row;
};
export function applyOrganizationScope<T extends QueryArgs>(
    model: string,
    operation: string,
    args: T,
    organizationId: string | undefined,
): T {
    if (!TENANT_MODELS.has(model)) {
        return args;
    }

    if (!organizationId) {
        throw new TenantScopeError(
            `Tenant model ${model}.${operation} was called without an organization scope`,
        );
    }

    if (UNIQUE_WHERE_OPERATIONS.has(operation)) {
        throw new TenantScopeError(
            `${model}.${operation} cannot be organization-scoped. Use findFirst, updateMany, or deleteMany.`,
        );
    }

    if (CREATE_OPERATIONS.has(operation)) {
        return {
            ...args,
            data: scopeRow(singleRow(args.data, model, operation), organizationId, model, operation),
        } as T;
    }

    if (CREATE_MANY_OPERATIONS.has(operation)) {
        return {
            ...args,
            data: manyRows(args.data, model, operation).map((row) =>
                scopeRow(row, organizationId, model, operation),
            ),
        } as T;
    }

    if (WHERE_OPERATIONS.has(operation)) {
        return {
            ...args,
            where: scopeWhere(args.where, organizationId, model, operation),
        } as T;
    }

    // ponytail: unknown operations fail closed. Add the name to a set above when Prisma adds one.
    throw new TenantScopeError(`Unsupported tenant operation ${model}.${operation}`);
}

function singleRow(data: QueryArgs['data'], model: string, operation: string): Row {
    if (data === undefined || Array.isArray(data)) {
        throw new TenantScopeError(`${model}.${operation} expects one data object`);
    }
    return data;
}

function manyRows(data: QueryArgs['data'], model: string, operation: string): Row[] {
    if (data === undefined) {
        throw new TenantScopeError(`${model}.${operation} expects data`);
    }
    return Array.isArray(data) ? [...data] : [data];
}

function scopeWhere(
    where: Row | undefined,
    organizationId: string,
    model: string,
    operation: string,
): Row {
    assertSameOrganization(where?.organizationId, organizationId, model, operation);
    return { ...where, organizationId };
}

function scopeRow(row: Row, organizationId: string, model: string, operation: string): Row {
    assertSameOrganization(row.organizationId, organizationId, model, operation);
    return { ...row, organizationId };
}

function assertSameOrganization(
    existing: unknown,
    organizationId: string,
    model: string,
    operation: string,
): void {
    if (existing === undefined) {
        return;
    }
    if (existing !== organizationId) {
        throw new TenantScopeError(
            `${model}.${operation} organizationId does not match the scoped client`,
        );
    }
}

export function organizationScopeExtension(organizationId: string) {
    return Prisma.defineExtension({
        name: 'organizationScope',
        query: {
            $allModels: {
                $allOperations({ model, operation, args, query }) {
                    const scoped = applyOrganizationScope(
                        model,
                        operation,
                        args as QueryArgs,
                        organizationId,
                    );
                    return query(scoped as typeof args);
                },
            },
        },
    });
}