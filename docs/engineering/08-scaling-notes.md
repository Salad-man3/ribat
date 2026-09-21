# 08 — Scaling notes

> **This is design reasoning, not built work.** None of it is implemented, and most of it
> should never be. It exists to record where the first limits are, in what order they arrive,
> and what the answer is when one does.

---

## 1. Today's numbers

Per mosque, from the pilot (decision 1.3):

| Quantity | Pilot |
| --- | --- |
| Members | 200 |
| Teachers | 10 |
| Courses | 4 |
| Sessions per month | ~70 |
| Attendance rows per month | ~900 |
| Progress logs per month | ~400 |
| Notifications per day | ~150 |
| Peak concurrency | 10 teachers syncing after a class |

A single Postgres instance and one container carry this with room to spare. The interesting
question is not users per mosque — it is **mosques**, because every background cost grows with
tenants.

## 2. Extrapolation

At **100 mosques** (rough estimates, not measurements):

| Quantity | Estimate |
| --- | --- |
| Members | ~20,000 |
| Attendance rows | ~90,000 per month, ~1.1M per year |
| Progress logs | ~40,000 per month |
| Evening notification fan-out | ~15,000 rows per night, in one window |
| Nightly rollup scope | 100 organizations × 4 scopes |
| Sync requests | a few thousand per day, bursting after class times |

Row counts stay small for PostgreSQL. **The load is batch-shaped, not request-shaped**, and it
concentrates in the evening, because that is when classes end and summaries go out.

## 3. Where it breaks, in order

| # | Limit | Symptom | Response |
| --- | --- | --- | --- |
| 1 | Nightly jobs grow linearly with tenants | Rollups and summaries overrun their window | Run per organization in parallel with a bounded pool; keep rollups incremental (only yesterday) rather than full recomputes |
| 2 | Evening fan-out bursts | Notification writes and push delivery spike in one hour | Spread by organization timezone and stagger inside the window; batch inserts |
| 3 | One big mosque starves the others | A 2,000-member tenant monopolises workers | Per-tenant fairness: queue groups keyed by `organizationId`, concurrency caps per tenant |
| 4 | Worker and API compete | Sync latency rises while jobs run | Already separable — run the image with `WORKER=1` on its own instance |
| 5 | Connection pressure | More workers than Postgres connections | PgBouncer in transaction mode; Prisma pool sized per process |
| 6 | Ledger growth | Attendance, logs, audit and events reach tens of millions | Monthly partitioning on the append-only tables; archive or prune `DomainEvent` and read notifications (`retention.prune`) |
| 7 | Reporting competes with writes | Dashboards slow the transactional path | A read replica for statistics and exports |
| 8 | A single database stops fitting | Vertical scaling exhausted | Shard by `organizationId` — every tenant row already carries it, so the shard key exists from day one |
| 9 | One axis genuinely scales differently | e.g. push delivery to millions of devices | Extract **that** service only, keeping the monolith otherwise intact |

Steps 1–5 cover realistic growth for years. Step 8 is the first one that would change the
architecture, and it is cheap to reach because tenancy was designed in from the first
migration ([ADR-0002](./adr/0002-tenant-isolation.md)).

## 4. What stays the same

- **The offline contract.** More mosques do not change a phone's class kit or replay; that
  design scales with teachers, not tenants.
- **Events over a broker.** Even at 100 mosques, reactions are in the low thousands per day.
  The outbox in Postgres remains the right size ([ADR-0009](./adr/0009-events-and-outbox.md)).
- **One deployable.** Nothing in §3 requires splitting the monolith before step 9.

## 5. Hosted-service concerns

These arrive with paying tenants rather than with load:

- **Noisy neighbours** — per-tenant rate limits on `/sync` and per-tenant queue concurrency.
- **Plan limits** — enforced at provisioning by the control plane, never as checks in the app
  ([ADR-0008](./adr/0008-distribution-model.md)).
- **Tenant-level backup and restore** — restoring one mosque without touching the others,
  which favours partitioned or per-tenant dumps over a single cluster snapshot.
- **Migration blast radius** — one schema change now affects every customer at once; this is
  where expand-then-contract stops being theory.

## 6. Self-hosting pulls the other way

A self-hoster runs one mosque on a small VPS, so the pressure is **downward**: the stack must
stay small. Two honest costs of current decisions:

- **Redis is required**, which is a second service for a deployment that would be happy with
  one. pg-boss would remove it ([ADR-0009](./adr/0009-events-and-outbox.md) alternatives).
  Revisit if self-hosters complain; do not maintain two queue backends.
- **The worker can share the API process** in `self_host` mode, so a 1 GB VPS runs one
  container plus Postgres and Redis.

## 7. What this project will not do

Microservices, Kafka, Kubernetes, gRPC, a service mesh, event sourcing as the system of
record, or a separate read database. Each solves a problem Ribat does not have, and each adds
failure modes a solo maintainer — or a self-hoster — would have to operate. If a reviewer
asks why not, the answer is §2: the numbers.
