export type TimedBlock = { id: string; startsAt: string; endsAt: string };

/** Assign column index for overlapping blocks (side-by-side layout). */
export function overlapColumns(blocks: TimedBlock[]): Map<string, number> {
  const sorted = [...blocks].sort((a, b) =>
    a.startsAt.localeCompare(b.startsAt),
  );
  const columns = new Map<string, number>();
  const active: { id: string; end: number; col: number }[] = [];
  for (const b of sorted) {
    const start = Date.parse(b.startsAt);
    const end = Date.parse(b.endsAt);
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i]!.end <= start) active.splice(i, 1);
    }
    const used = new Set(active.map((a) => a.col));
    let col = 0;
    while (used.has(col)) col++;
    columns.set(b.id, col);
    active.push({ id: b.id, end, col });
  }
  return columns;
}
