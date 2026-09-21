# ADR-0010 — Derived read models and rebuilds

**Status:** Accepted · **Date:** 2026-09-18

## Context

Two requirements force derived data, independently of any architectural preference.

- **Class mode must show each student's last position offline** ([05-offline-sync.md](../05-offline-sync.md)).
  Computing it means merging an append-only ledger of ayah ranges, which is not something a
  phone should do inside a 150 KB kit.
- **The sheikh's dashboard** reads attendance rates, pages memorized and test counts across a
  mosque. Decision 17.5 accepted numbers up to 24 hours old.

Meanwhile the write side is append-only by domain: memorization logs, material logs, the
points ledger and the audit log ([ADR-0005](./0005-memorization-model.md), DM-08).

## Decision

1. **Two projections, different consistency, on purpose.**
   - `MemorizationSummary` is updated **in the same transaction** as the log that changes it.
     Class mode cannot show a stale last position, so this one is strongly consistent.
   - `StatsDaily` is built by a **nightly job**. Staleness is a product decision, not an
     accident, and it is stated in the UI.
2. **Every projection has a rebuild command**, and rebuilding is safe to run at any time:
   `pnpm --filter api projections:rebuild --target=summary|stats [--org=…]`.
3. **Every projection has a drift test**: rebuild from the ledger and assert the result equals
   the incrementally maintained value. This is the test that makes the pattern trustworthy.
4. **Projections are disposable.** They are never the source of truth, never the only place a
   fact exists, and may be dropped and rebuilt during an incident or a migration.
5. **Call it what it is.** These are derived read models in the same database. The term CQRS
   is avoided, because there is no separate read store and claiming one invites a question
   with no good answer.

## Consequences

- A summary bug shows up as a wrong "last position" in front of a teacher, so the write path
  that maintains it is covered by tests first.
- The nightly job's cost grows with mosques, not with users — the first scaling limit named in
  [08-scaling-notes.md](../08-scaling-notes.md).
- Statistics queries never touch the ledgers, which keeps the dashboard flat as history grows.
- Rebuild commands also serve self-hosters after an upgrade or a restore
  ([ADR-0008](./0008-distribution-model.md)).

## Alternatives considered

- **Compute on read** — fine at pilot size and simplest, but it cannot serve the offline kit,
  and the dashboard would scan growing ledgers on every visit.
- **Materialized views** — a reasonable fit for `StatsDaily` and a poor one for
  `MemorizationSummary`, which must update transactionally with a write. Keeping both as plain
  tables means one mechanism, one rebuild command and one test shape.
- **A separate read database** — real CQRS, and unjustifiable at this size.
