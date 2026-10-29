import { Inject, Injectable, Optional, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { createPrismaClient } from './create-prisma-client';
import { organizationScopeExtension } from './organization-scope';

export const OPTIONAL_PRISMA_CLIENT = 'OPTIONAL_PRISMA_CLIENT';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly client: PrismaClient;

  /** Optional client supports PGlite in the browser demo and focused tests. */
  constructor(
    @Optional()
    @Inject(OPTIONAL_PRISMA_CLIENT)
    client?: PrismaClient,
  ) {
    this.client = client ?? createPrismaClient();
  }

  async onModuleInit() {
    await this.client.$connect();
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }

  get $queryRaw() {
    return this.client.$queryRaw.bind(this.client);
  }

  /** Identity, AuthSession, AccountSetupCode, and the caller's own memberships. */
  get platform(): PrismaClient {
    return this.client;
  }

  forOrganization(organizationId: string) {
    return this.client.$extends(organizationScopeExtension(organizationId));
  }
}

export type OrgDb = ReturnType<PrismaService['forOrganization']>;
/** The client inside `forOrganization(id).$transaction(async (tx) => …)`. */
export type OrgTx = Parameters<
  Extract<Parameters<OrgDb['$transaction']>[0], (...args: never[]) => unknown>
>[0];
