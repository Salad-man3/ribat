import type { PrismaClient } from '@prisma/client';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('exposes an injected client as platform', () => {
    const client = {
      $connect: jest.fn().mockResolvedValue(undefined),
      $disconnect: jest.fn().mockResolvedValue(undefined),
    } as unknown as PrismaClient;

    const service = new PrismaService(client);

    expect(service.platform).toBe(client);
  });

  it('connects and disconnects the injected client on lifecycle hooks', async () => {
    const client = {
      $connect: jest.fn().mockResolvedValue(undefined),
      $disconnect: jest.fn().mockResolvedValue(undefined),
    } as unknown as PrismaClient;

    const service = new PrismaService(client);
    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(client.$connect).toHaveBeenCalledTimes(1);
    expect(client.$disconnect).toHaveBeenCalledTimes(1);
  });
});
