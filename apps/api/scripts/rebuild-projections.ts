import 'dotenv/config';
import type { PrismaClient } from '@prisma/client';
import { createPrismaClient } from '../src/prisma/create-prisma-client.js';
import { organizationScopeExtension } from '../src/prisma/organization-scope';
import { writeSummary } from '../src/progress/memorization-summary';
import { rebuildStatsForOrganization } from '../src/stats/stats-rebuild.js';
import { StatsRollupService } from '../src/stats/stats-rollup.service.js';
import type { Env } from '../src/config/env.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * ADR-0010: drops and recreates derived read models from ledgers. Safe at any time.
 *   pnpm --filter api projections:rebuild [--target=summary|stats] [--org=<uuid>]
 */
export async function rebuildSummaries(
  prisma: PrismaClient,
  organizationId: string,
): Promise<number> {
  const db = prisma.$extends(organizationScopeExtension(organizationId));
  return db.$transaction(
    async (tx) => {
      await tx.memorizationSummary.deleteMany({});
      const pairs = await tx.memorizationLog.findMany({
        distinct: ['memberId', 'materialId'],
        select: { memberId: true, materialId: true },
      });
      for (const { memberId, materialId } of pairs)
        await writeSummary(tx, organizationId, memberId, materialId);
      return pairs.length;
    },
    { timeout: 120_000 },
  );
}

function rollupService(prisma: PrismaClient): StatsRollupService {
  const env = { JOBS_WORKER: 'off' } as Env;
  return new StatsRollupService(env, prisma as unknown as PrismaService);
}

async function main() {
  const args = Object.fromEntries(
    process.argv
      .slice(2)
      .map((a) => a.replace(/^--/, '').split('=') as [string, string]),
  );
  const target = args.target ?? 'summary';
  if (target !== 'summary' && target !== 'stats') {
    console.error(`Unknown target ${target}; use "summary" or "stats"`);
    process.exit(1);
  }
  const prisma = createPrismaClient();
  const orgs = args.org
    ? [{ id: args.org }]
    : await prisma.organization.findMany({ select: { id: true } });
  for (const org of orgs) {
    if (target === 'summary') {
      console.log(`${org.id}: ${await rebuildSummaries(prisma, org.id)} summaries`);
    } else {
      const rollup = rollupService(prisma);
      if (args.org) {
        await prisma.$executeRawUnsafe(
          `DELETE FROM "StatsDaily" WHERE "organizationId" = $1`,
          org.id,
        );
      }
      console.log(
        `${org.id}: ${await rebuildStatsForOrganization(prisma as unknown as PrismaService, org.id, rollup)} stat days`,
      );
    }
  }
  await prisma.$disconnect();
}

if (require.main === module) void main();
