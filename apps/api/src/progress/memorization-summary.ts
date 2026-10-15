import type { OrgTx } from '../prisma/prisma.service';
import { summarize } from './policy';

type SummaryDb = Pick<OrgTx, 'memorizationLog' | 'memorizationSummary'>;

/**
 * ADR-0010: rewrites one (member, material) summary from the ledger.
 * Called inside the transaction of every log and void, and by the rebuild command,
 * so the incremental value and a rebuild are the same function by construction.
 * ponytail: recomputes from every log of that pair (hundreds at most); switch to a delta when a member's ledger gets large.
 */
export async function writeSummary(
  db: SummaryDb,
  organizationId: string,
  memberId: string,
  materialId: string,
): Promise<void> {
  const logs = await db.memorizationLog.findMany({
    where: { memberId, materialId, voidedAt: null },
    select: {
      type: true,
      surahStart: true,
      ayahStart: true,
      surahEnd: true,
      ayahEnd: true,
      pageFrom: true,
      pageTo: true,
      loggedAt: true,
    },
  });
  const data = summarize(logs);
  const { count } = await db.memorizationSummary.updateMany({
    where: { memberId, materialId },
    data,
  });
  if (count === 0)
    await db.memorizationSummary.create({
      data: { organizationId, memberId, materialId, ...data },
    });
}
