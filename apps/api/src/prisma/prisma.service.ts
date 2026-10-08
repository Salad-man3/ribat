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

  forOrganization(organizationId: string) {
    return this.client.$extends(organizationScopeExtension(organizationId));
  }
}