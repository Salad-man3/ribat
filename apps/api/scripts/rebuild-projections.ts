import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { organizationScopeExtension } from '../src/prisma/organization-scope';
import { writeSummary } from '../src/progress/memorization-summary';

/**
 * ADR-0010: drops and recreates MemorizationSummary from the ledger. Safe at any time.
 *   pnpm --filter api projections:rebuild [--target=summary] [--org=<uuid>]
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

async function main() {
  const args = Object.fromEntries(
    process.argv
      .slice(2)
      .map((a) => a.replace(/^--/, '').split('=') as [string, string]),
  );
  if ((args.target ?? 'summary') !== 'summary') {
    console.error(
      `Unknown target ${args.target}; the only projection is "summary"`,
    );
    process.exit(1);
  }
  const prisma = new PrismaClient();
  const orgs = args.org
    ? [{ id: args.org }]
    : await prisma.organization.findMany({ select: { id: true } });
  for (const org of orgs)
    console.log(
      `${org.id}: ${await rebuildSummaries(prisma, org.id)} summaries`,
    );
  await prisma.$disconnect();
}

if (require.main === module) void main();
