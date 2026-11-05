/** Furthest explanation page reached in class, as 0–100 or null when no book. */
export async function explanationPercentByCourse(
  // ponytail: org-scoped Prisma extension; narrow selects are enforced at call sites
  db: {
    materialLog: { findMany: (args: unknown) => Promise<unknown> };
    courseMaterial: { findMany: (args: unknown) => Promise<unknown> };
  },
  courseIds: string[],
): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>();
  if (!courseIds.length) return out;

  const links = (await db.courseMaterial.findMany({
    where: { courseId: { in: courseIds }, track: 'EXPLANATION' },
    include: { material: { select: { totalPages: true } } },
  })) as {
    courseId: string;
    materialId: string;
    material: { totalPages: number | null };
  }[];
  const bookOf = new Map<string, { materialId: string; totalPages: number }>();
  for (const link of links) {
    const total = link.material.totalPages;
    if (total && total > 0)
      bookOf.set(link.courseId, {
        materialId: link.materialId,
        totalPages: total,
      });
  }

  const materialIds = [
    ...new Set([...bookOf.values()].map((b) => b.materialId)),
  ];
  const logs =
    materialIds.length === 0
      ? []
      : ((await db.materialLog.findMany({
          where: {
            session: { courseId: { in: courseIds } },
            materialId: { in: materialIds },
          },
          select: {
            pageTo: true,
            materialId: true,
            session: { select: { courseId: true } },
          },
        })) as {
          pageTo: number;
          materialId: string;
          session: { courseId: string };
        }[]);

  const furthest = new Map<string, number>();
  for (const row of logs) {
    const cid = row.session.courseId;
    const book = bookOf.get(cid);
    if (!book || book.materialId !== row.materialId) continue;
    const prev = furthest.get(cid) ?? 0;
    if (row.pageTo > prev) furthest.set(cid, row.pageTo);
  }

  for (const cid of courseIds) {
    const book = bookOf.get(cid);
    if (!book) {
      out.set(cid, null);
      continue;
    }
    const page = furthest.get(cid) ?? 0;
    out.set(cid, Math.min(100, Math.round((page / book.totalPages) * 100)));
  }
  return out;
}

export function pagesHeardFromLogs(
  logs: { courseId: string | null; pageFrom: number; pageTo: number }[],
): Map<string, number> {
  const sums = new Map<string, number>();
  for (const row of logs) {
    if (!row.courseId) continue;
    const span = row.pageTo - row.pageFrom + 1;
    sums.set(row.courseId, (sums.get(row.courseId) ?? 0) + span);
  }
  return sums;
}
