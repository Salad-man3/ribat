import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { organizationScopeExtension } from './organization-scope';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly client = new PrismaClient();

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
